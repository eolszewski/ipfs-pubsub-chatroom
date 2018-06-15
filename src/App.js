import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { withStyles } from '@material-ui/core/styles';
import AppBar from '@material-ui/core/AppBar';
import Toolbar from '@material-ui/core/Toolbar';
import Card from '@material-ui/core/Card';
import CardActions from '@material-ui/core/CardActions';
import CardContent from '@material-ui/core/CardContent';
import CardHeader from '@material-ui/core/CardHeader';
import Button from '@material-ui/core/Button';
import Typography from '@material-ui/core/Typography';
import Grid from '@material-ui/core/Grid';
import LinearProgress from '@material-ui/core/LinearProgress';
import Input from '@material-ui/core/Input';
import InputLabel from '@material-ui/core/InputLabel';
import FormControl from '@material-ui/core/FormControl';

import IPFS from 'ipfs';
import Room from 'ipfs-pubsub-room';

const styles = theme => ({
  root: {
    flexGrow: 1,
  },
  flex: {
    flex: 1,
  }
});

const ipfsOptions = {
  EXPERIMENTAL: {
    pubsub: true
  },
  config: {
    Addresses: {
      Swarm: [
        "/dns4/ws-star.discovery.libp2p.io/tcp/443/wss/p2p-websocket-star"
      ]
    }
  }
};

class App extends Component {
  constructor(props) {
    super(props);
    this.ipfs = new IPFS(ipfsOptions);
    this.state = {
      info: null,
      selectedAddress: '',
      message: '',
      messages: []
    }
  }

  componentWillMount() {
    this.ipfs.once('ready', () => this.ipfs.id((err, info) => {
      console.log('info: ', info);
      if (err) { throw err }
      this.setState({ info });

      this.room = Room(this.ipfs, 'ipfs-pubsub-demo');
      this.room.on('peer joined', (peer) => { 
        console.log(peer + ' has joined');
        this.room.sendTo(peer, 'Hello ' + peer + '!')
      });
      this.room.on('peer left', (peer) => console.log(peer + ' has left'));
      this.room.on('message', (message) => console.log(`From: ${message.from}\nBody: ${message.data.toString()}`));
    }))
  }

  handleMessage = event => {
    this.room.sendTo(this.state.selectedAddress, this.state.message);
  }

  handleBroadcast = event => {
    this.room.broadcast(this.state.message);
  }

  render() {
    const { classes } = this.props;
    const { info, selectedAddress, message, messages } = this.state;

    return (
      <div className={classes.root}>
        <AppBar position="static">
          <Toolbar>
            <Typography variant="title" color="inherit" className={classes.flex}>
              IPFS Pubsub Chatroom
            </Typography>
          </Toolbar>
        </AppBar>

        { info != null ? 
          <Grid container alignItems={'center'} justify={'center'} spacing={24} style={{ padding: 24 }}>
            <Grid item xs={8}>
              <Card>
                <CardContent>
                  <Typography gutterBottom variant="headline" component="h4">
                    My Information
                  </Typography>
                  <FormControl fullWidth style={{ marginBottom: '16px' }}>
                    <InputLabel htmlFor="id">ID</InputLabel>
                    <Input id="id" value={info.id} />
                  </FormControl>
                  <FormControl fullWidth style={{ marginBottom: '16px' }}>
                    <InputLabel htmlFor="publicKey">Public Key</InputLabel>
                    <Input id="publicKey" multiline={true} value={info.publicKey} />
                  </FormControl>
                </CardContent>
                <CardActions>
                  <Button size="small" color="primary">
                    Share
                  </Button>
                  <Button size="small" color="primary">
                    Learn More
                  </Button>
                </CardActions>
              </Card>
            </Grid>
          </Grid> :
          <LinearProgress />
        }
      </div>
    );
    // return (
    //   <div className="App">
    //     <header className="App-header">
    //       <img src={logo} className="App-logo" alt="logo" />
    //       <h1 className="App-title">Welcome to React</h1>
    //     </header>
    //     <p>My topics: {topics}</p>
    //     <form onSubmit={this.handleMessage}>
    //       <label>
    //         Node Address
    //         <input type="text" value={selectedAddress} onChange={(e) => this.setState({ selectedAddress: e.target.value })} />
    //       </label>
    //       <label>
    //         Message
    //         <input type="text" value={message} onChange={(e) => this.setState({ message: e.target.value })} />
    //       </label>
    //       <input type="submit" value="Send Message" />
    //     </form>
    //     <form onSubmit={this.handleBroadcast}>
    //       <label>
    //         Message
    //         <input type="text" value={message} onChange={(e) => this.setState({ message: e.target.value })} />
    //       </label>
    //       <input type="submit" value="Send Broadcast" />
    //     </form>
    //   </div>
    // );
  }
}

App.propTypes = {
  classes: PropTypes.object.isRequired,
};

export default withStyles(styles)(App);
