const SimplePaymentChannel = artifacts.require('./SimplePaymentChannel.sol');
const utils = require('./utils.js');

contract('SimplePaymentChannel', accounts => {

  let spc;
  let sender = accounts[0];
  let recipient = accounts[1];
  let deposit = web3.toWei('10', 'ether');
  let signatures = [];
  let currentTime;

  describe('constructor', () => {
    
    before(async () => {
      currentTime = Math.floor(new Date().getTime() / 1000);
      spc = await SimplePaymentChannel.new(recipient, 60, { from: sender, value: deposit });
    });

    it('emits ChannelOpened event', async () => {
      assert.ok(utils.getEvent('ChannelOpened', web3.eth.getTransactionReceipt(spc.transactionHash)), 'should log an ChannelOpened event');
    });

    it('sets the correct sender', async () => {
      assert(sender == await spc.sender.call());
    });

    it('sets the correct recipient', async () => {
      assert(recipient == await spc.recipient.call());
    });

    it('sets the correct expiration', async () => {
      assert((currentTime + 60) == await spc.expiration.call());
    });

    it('sets the correct balance', async () => {
      assert(deposit == web3.eth.getBalance(spc.address));
    });
  });

  describe('extendExpiration', () => {

    before(async () => {
      currentTime = Math.floor(new Date().getTime() / 1000);
      spc = await SimplePaymentChannel.new(recipient, 1, { from: sender, value: deposit });
    });

    it('cannot update expiration to be earlier', async () => {
      await utils.assertFail(spc.extendExpiration(currentTime, { from: sender }));
    });

    it('can only be called by sender', async () => {
      await utils.assertFail(spc.extendExpiration(currentTime + 10, { from: recipient }));
    });

    it('updates contract expiration', async () => {
      await spc.extendExpiration(currentTime + 10, { from: sender });
      assert((currentTime + 10) == await spc.expiration.call());
    });
  });

  describe('claimTimeout', () => {

    before(async () => {
      currentTime = Math.floor(new Date().getTime() / 1000);
      spc = await SimplePaymentChannel.new(recipient, 1, { from: sender, value: deposit });
    });

    it('cannot only be called after contract expiry', async () => {
      await utils.assertFail(spc.claimTimeout({ from: sender }));
    });

    it('returns balance to sender', function (done) {
      let senderBalance = web3.eth.getBalance(sender).toNumber();
      let spcBalance = web3.eth.getBalance(spc.address).toNumber();

      setTimeout(function () {
        spc.claimTimeout({ from: sender }).then(tx => {
          assert(senderBalance + spcBalance - 2e15 < web3.eth.getBalance(sender).toNumber());
          done();
        });
      }, 1000);
    });
  });

  describe('closeChannel', () => {

    let senderBalance;
    let recipientBalance;

    before(async () => {
      currentTime = Math.floor(new Date().getTime() / 1000);
      spc = await SimplePaymentChannel.new(recipient, 1, { from: sender, value: deposit });

      // generate valid signature on the client
      let message = await utils.constructPaymentMessage(spc.address, web3.toWei('1', 'ether'));
      let signature = await utils.signMessage(web3, message, sender);
      signatures.push(signature);

      // validate signature
      assert(await utils.isValidSignature(spc.address, web3.toWei('1', 'ether'), signature, sender));

      // save sender and recipient balance
      senderBalance = web3.eth.getBalance(sender).toNumber();
      recipientBalance = web3.eth.getBalance(recipient).toNumber();
    });

    it('cannot be called with invalid recipient balance', async () => {
      await utils.assertFail(spc.closeChannel(web3.toWei('2', 'ether'), signatures[signatures.length - 1], { from: recipient }));
    });

    it('cannot be called by the sender', async () => {
      await utils.assertFail(spc.closeChannel(web3.toWei('1', 'ether'), signatures[signatures.length - 1], { from: sender }));
    });

    it('emits a ChannelClosed event', async () => {
      let tx = await spc.closeChannel(web3.toWei('1', 'ether'), signatures[signatures.length - 1], { from: recipient });
      assert.ok(utils.getEvent('ChannelClosed', tx), 'should log an ChannelClosed event');
    });

    it('remits payment to sender', async () => {
      assert(senderBalance + parseInt(web3.toWei('9', 'ether')) - 8e15 < web3.eth.getBalance(sender).toNumber());
    });

    it('remits payment to recipient', async () => {
      assert(recipientBalance + parseInt(web3.toWei('1', 'ether')) - 8e15 < web3.eth.getBalance(recipient).toNumber());
    });
  });
});
