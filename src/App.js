import React, { Component } from 'react';
import PropTypes from 'prop-types';

import IPFS from 'ipfs';
import Room from 'ipfs-pubsub-room';
import _ from 'lodash';
import Web3 from 'web3';
import contract from 'truffle-contract';

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
import Select from '@material-ui/core/Select';
import List from '@material-ui/core/List';
import ListItem from '@material-ui/core/ListItem';
import ListItemText from '@material-ui/core/ListItemText';
 
import theme from './theme';
import config from './ipfs_pubsub_config';
import utils from './utils';

const SimplePaymentChannelArtifact = require('./contracts/SimplePaymentChannel.json');

const styles = theme => ({
  root: {
    flexGrow: 1,
  },
  flex: {
    flex: 1,
  }
});

class App extends Component {
  constructor(props) {
    super(props);
    this.ipfs = new IPFS(config);

    if (typeof window.web3 !== 'undefined') {
      this.web3 = new Web3(window.web3.currentProvider);
      this.simplePaymentChannelContract = contract(SimplePaymentChannelArtifact);
      this.simplePaymentChannelContract.setProvider(this.web3.currentProvider);
    }

    this.state = {
      info: null,
      amount: 0,
      address: null,
      channelAddress: null,
      balance: null,
      channelBalance: null,
      message: '',
      messages: [],
      selectedPeer: {},
      peers: {},
      receiver: false
    }

    this.createSignature = this.createSignature.bind(this);
    this.selectPeer = this.selectPeer.bind(this);
    this.isIntroductoryMessage = this.isIntroductoryMessage.bind(this);
    this.updatePeerStatus = this.updatePeerStatus.bind(this);
    this.updateAddress = this.updateAddress.bind(this);
    this.getAddressBalance = this.getAddressBalance.bind(this);
    this.createChannel = this.createChannel.bind(this);
    this.closeChannel = this.closeChannel.bind(this);
  }

  componentWillMount() {
    this.ipfs.once('ready', () => this.ipfs.id(async (err, info) => {
      if (err) { throw err }
      this.setState({ info });

      let accounts = await this.web3.eth.getAccounts();
      const currentPeerInfo = {
        id: info.id,
        address: accounts[0],
        online: true
      };
      this.updateAddress(accounts[0]);

      let balance = await this.getAddressBalance(accounts[0]);
      this.setState({ balance });

      this.room = Room(this.ipfs, 'pubsub-payment-channel-demo');

      this.room.on('peer joined', (peer) => {
        // Send introductory message to peer
        this.room.sendTo(peer, JSON.stringify(currentPeerInfo));
      });

      this.room.on('peer left', (peer) => {
        this.updatePeerStatus(peer, false);
      });

      this.room.on('peer left', (peer) => {
        // Notify Peer has Left
        console.log(peer + ' has left');
      });
      
      this.room.on('message', async (message) => {
        // Check if this is an introductory message
        if (this.isIntroductoryMessage(message.data.toString())) {
          // Check if peer is already known
          if (_.includes(_.keys(this.state.peers), message.from)) {
            // Known peer, update online status
            this.updatePeerStatus(message.from, true);
          } else {
            // Unknown peer, update peers map
            let newPeer = JSON.parse(message.data.toString());
            let updatedPeers = this.state.peers;
            updatedPeers[message.from] = newPeer;
            this.setState({ peers: updatedPeers });
            if (_.keys(this.state.peers).length === 1) {
              this.setState({ selectedPeer: newPeer });
            }
          }
        } else {
          // We don't want to broadcast to ourself
          if (message.from !== info.id) {
            console.log('message: ', message);
            let parsedMessage = JSON.parse(message.data.toString());
            console.log('parsedMessage: ', parsedMessage);
            if (parsedMessage.eventType === 'CREATE') {
              // Need to set selectedPeer as well
              this.setState({ channelAddress: parsedMessage.channelAddress, channelBalance: parsedMessage.channelBalance, amount: 0, receiver: true, selectedPeer: this.state.peers[message.from].address })
            } else if (parsedMessage.eventType === 'SIGN') {
              // Update Messages
              let updatedMessages = this.state.messages;
              updatedMessages.push(message);
              this.setState({ messages: updatedMessages });
            } else if (parsedMessage.eventType === 'CLOSE') {
              this.setState({ messages: [], receiver: false, channelAddress: null, channelBalance: null, amount: 0 });
              let balance = await this.getAddressBalance(this.state.address);
              this.setState({ balance });
            }
          }
        }
      });
    }))
  }

  createChannel = async event => {
    const { channelAddress, amount, address, selectedPeer } = this.state;
    console.log('selectedPeer: ', selectedPeer);
    // Default expiry of 10 minutes
    this.simplePaymentChannelInstance = await this.simplePaymentChannelContract.new(selectedPeer.address, 600, { from: address, value: this.web3.utils.toWei(amount, 'ether') });
    this.setState({ channelAddress: this.simplePaymentChannelInstance.address, channelBalance: this.web3.utils.toWei(amount, 'ether') });
    console.log('this.simplePaymentChannelInstance: ', this.simplePaymentChannelInstance);
    console.log('channelBalance', this.web3.utils.toWei(amount, 'ether'));
    this.room.sendTo(selectedPeer.id, JSON.stringify({
      eventType: 'CREATE',
      channelAddress: this.simplePaymentChannelInstance.address,
      channelBalance: this.web3.utils.toWei(amount, 'ether')
    }));
    this.setState({ amount: 0 });
  }

  createSignature = async event => {
    const { channelAddress, amount, messages, address, selectedPeer } = this.state;
    let message = await utils.constructPaymentMessage(channelAddress, this.web3.utils.toWei(amount, 'ether'));
    let signature = await utils.signMessage(this.web3, message, address);
    message = {
      eventType: 'SIGN',
      channelAddress: this.simplePaymentChannelInstance.address,
      amount: this.web3.utils.toWei(amount, 'ether'),
      signature
    };
    this.room.sendTo(selectedPeer.id, JSON.stringify(message));
    let updatedMessages = messages;
    updatedMessages.push(message);
    this.setState({ messages: updatedMessages, amount: 0 });
  }

  closeChannel = async event => {
    const { messages, address, selectedPeer } = this.state;
    await this.simplePaymentChannelInstance.closeChannel(messages[messages.length - 1].amount, messages[messages.length - 1].signature, { from: address });
    let message = {
      eventType: 'CLOSE',
      channelAddress: this.simplePaymentChannelInstance.address
    };
    let balance = await this.getAddressBalance(address);
    this.setState({ messages: [], receiver: false, channelAddress: null, channelBalance: null, amount: 0, balance });
    this.room.sendTo(selectedPeer.id, JSON.stringify(message));
  }

  selectPeer = event => {
    this.setState({
      selectedPeer: event.target.value
    });
  };

  updatePeerStatus = (peer, status) => {
    let updatedPeers = this.state.peers;
    let updatedPeer = updatedPeers[peer];
    // Update peer's online status
    updatedPeer.online = status;
    updatedPeers[peer] = updatedPeer;
    this.setState({ peers: updatedPeers });
  };

  isIntroductoryMessage = msg => {
    try {
      let parsedMsg = JSON.parse(msg);
      return _.difference(['address', 'id', 'online'], _.keys(parsedMsg)).length === 0
    } catch (e) {
      return false;
    }
  }

  updateAddress = (address) => {
    this.setState({
      address
    })
  }

  getAddressBalance = async address => {
    let balance = await this.web3.eth.getBalance(address);
    return this.web3.utils.fromWei(balance, 'ether');
  }

  render() {
    const { classes } = this.props;
    const { amount, info, messages, selectedPeer, peers, address, balance, channelAddress, receiver } = this.state;

    return (
      <div className={classes.root}>
        <AppBar position="static">
          <Toolbar>
            <Typography variant="title" color="inherit" className={classes.flex}>
              Payment Channels Demo
            </Typography>
          </Toolbar>
        </AppBar>

        {!this.web3 && <p>y u no run metamask?</p>}
        {this.web3 && info != null && address != null && balance != null ?
          <Grid container alignItems={'center'} justify={'center'} spacing={24} style={{ padding: 24 }}>
            <Grid item xs={8}>
              <Card>
                <CardHeader title="My Information" />
                <CardContent>
                  <FormControl fullWidth style={{ marginBottom: '16px' }}>
                    <InputLabel htmlFor="address">Address</InputLabel>
                    <Input id="address" value={address} />
                  </FormControl>
                  <FormControl fullWidth style={{ marginBottom: '16px' }}>
                    <InputLabel htmlFor="balance">Balance</InputLabel>
                    <Input id="balance" value={balance} />
                  </FormControl>
                </CardContent>
              </Card>
            </Grid>
            {messages.length > 0 &&
              <Grid item xs={8}>
                <Card>
                  <CardHeader title="Channel Signatures" />
                  <CardContent>
                    <List dense={false} style={{ padding: 0 }}>
                      {messages.map(message => (
                        <ListItem
                          key={messages.indexOf(message)}
                          divider
                          disableGutters
                        >
                          <ListItemText
                            primary={peers[message.from].address}
                            secondary={message.data.toString()}
                          />
                        </ListItem>
                      ))}
                    </List>
                  </CardContent>
                </Card>
              </Grid>
            }
            <Grid item xs={8}>
              {channelAddress == null &&
                <Card>
                  <CardHeader title="Create Channel" />
                  <CardContent>
                    {_.keys(peers).length > 0 &&
                      <FormControl fullWidth style={{ marginBottom: '16px' }}>
                        <Select
                          native
                          onChange={this.selectPeer}
                          input={<Input id="uncontrolled-native" />}
                        >
                          {_.map(peers, (peer, id) => (
                            <option
                              key={id}
                              value={peer.address}
                              style={{
                                fontWeight:
                                  selectedPeer.id !== peer.id
                                    ? theme.typography.fontWeightRegular
                                    : theme.typography.fontWeightMedium
                              }}
                            >
                              {`${peer.address} (${peer.online ? 'Online' : 'Offline'})`}
                            </option>
                          ))}
                        </Select>
                      </FormControl>
                  }
                  <FormControl fullWidth style={{ marginBottom: '16px' }}>
                    <InputLabel htmlFor="amount">Amount</InputLabel>
                    <Input id="amount" value={amount} onChange={(e) => this.setState({ amount: e.target.value })} />
                  </FormControl>
                  </CardContent>
                  <CardActions>
                    <Button size="small" color="primary" disabled={_.keys(peers).length === 0 || selectedPeer === null || !selectedPeer.online || amount < 1} onClick={(e) => this.createChannel(e)}>
                      Create Channel
                    </Button>
                  </CardActions>
                </Card>
              }
              {channelAddress != null && !receiver &&
                <Card>
                  <CardHeader title="Send Signature" />
                  <CardContent>
                    <FormControl fullWidth style={{ marginBottom: '16px' }}>
                      <InputLabel htmlFor="amount">Amount</InputLabel>
                      <Input id="amount" value={amount} onChange={(e) => this.setState({ amount: e.target.value })} />
                    </FormControl>
                  </CardContent>
                  <CardActions>
                    <Button size="small" color="primary" disabled={_.keys(peers).length === 0 || selectedPeer === null || !selectedPeer.online || amount <= 0} onClick={(e) => this.createSignature(e)}>
                      Send Signature
                    </Button>
                  </CardActions>
                </Card>
              }
            </Grid>
          </Grid> :
          <LinearProgress />
        }
      </div>
    );
  }
}

App.propTypes = {
  classes: PropTypes.object.isRequired,
};

export default withStyles(styles)(App);
