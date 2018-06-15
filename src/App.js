import React, { Component } from 'react';

import IPFS from 'ipfs';
import Room from 'ipfs-pubsub-room';

import logo from './logo.svg';
import './App.css';

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
      address: '',
      message: '',
      topics: []
    }

    this.handleMessage = this.handleMessage.bind(this);
    this.handleBroadcast = this.handleBroadcast.bind(this);
  }

  handleMessage(event) {
    event.preventDefault();
    this.room.sendTo(this.state.address, this.state.message);
  }

  handleBroadcast(event) {
    event.preventDefault();
    this.room.broadcast(this.state.message);
  }

  componentWillMount() {
    this.ipfs.once('ready', () => this.ipfs.id((err, info) => {
      if (err) { throw err }
      console.log('My address: ' + info.id);

      this.room = Room(this.ipfs, 'ipfs-pubsub-demo');

      this.room.on('peer joined', (peer) => { 
        console.log(peer + ' has joined');
        this.room.sendTo(peer, 'Hello ' + peer + '!')
      });
      this.room.on('peer left', (peer) => console.log(peer + ' has left'));

      this.room.on('message', (message) => console.log(`From: ${message.from}\nBody: ${message.data.toString()}`));
    }))
  }

  render() {
    return (
      <div className="App">
        <header className="App-header">
          <img src={logo} className="App-logo" alt="logo" />
          <h1 className="App-title">Welcome to React</h1>
        </header>
        <p>My topics: {this.state.topics}</p>
        <form onSubmit={this.handleMessage}>
          <label>
            Node Address
            <input type="text" value={this.state.address} onChange={(e) => this.setState({ address: e.target.value })} />
          </label>
          <label>
            Message
            <input type="text" value={this.state.message} onChange={(e) => this.setState({ message: e.target.value })} />
          </label>
          <input type="submit" value="Send Message" />
        </form>
        <form onSubmit={this.handleBroadcast}>
          <label>
            Message
            <input type="text" value={this.state.message} onChange={(e) => this.setState({ message: e.target.value })} />
          </label>
          <input type="submit" value="Send Broadcast" />
        </form>
      </div>
    );
  }
}

export default App;
