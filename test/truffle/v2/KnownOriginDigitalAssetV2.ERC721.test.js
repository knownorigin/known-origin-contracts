const assertRevert = require('../../helpers/assertRevert');
const {sendTransaction} = require('../../helpers/sendTransaction');
const etherToWei = require('../../helpers/etherToWei');
const {shouldSupportInterfaces} = require('../SupportsInterface.behavior');

const bnChai = require('bn-chai');

const {advanceBlock} = require('../../helpers/time');

const _ = require('lodash');
const {inTransaction} = require("../../helpers/expectEvent");

const KnownOriginDigitalAssetV2 = artifacts.require('KnownOriginDigitalAssetV2');
const ERC721Receiver = artifacts.require('ERC721ReceiverMockV2.sol');

require('chai')
  .use(require('chai-as-promised'))
  .use(bnChai(web3.utils.BN))
  .should();

contract('KnownOriginDigitalAssetV2 - ERC721Token', function (accounts) {
  const _owner = accounts[0];

  const account1 = accounts[1];

  const account2 = accounts[2];

  const account3 = accounts[4];

  const artistAccount = accounts[8];
  const artistCommission = 76;

  const name = 'KnownOriginDigitalAsset';
  const symbol = 'KODA';

  const editionType = 1;

  const editionNumber1 = 100000;
  const editionData1 = web3.utils.asciiToHex("editionData1");
  const editionTokenUri1 = "edition1";
  const edition1Price = etherToWei(0.1);

  const editionNumber2 = 200000;
  const editionData2 = web3.utils.asciiToHex("editionData2");
  const editionTokenUri2 = "edition2";
  const edition2Price = etherToWei(0.1);

  const BASE_URI = "https://ipfs.infura.io/ipfs/";

  before(async function () {
    // Advance to the next block to correctly read time in the solidity "now" function interpreted by testrpc
    await advanceBlock();
  });

  beforeEach(async function () {
    this.token = await KnownOriginDigitalAssetV2.new({from: _owner});
  });

  beforeEach(async function () {
    await this.token.createActiveEdition(editionNumber1, editionData1, editionType, 0, 0, artistAccount, artistCommission, edition1Price, editionTokenUri1, 3, {from: _owner});
    await this.token.createActiveEdition(editionNumber2, editionData2, editionType, 0, 0, artistAccount, artistCommission, edition2Price, editionTokenUri2, 3, {from: _owner});
  });

  describe('like a full ERC721', function () {
    const firstTokenId = 100001;
    const secondTokenId = 200001;

    beforeEach(async function () {
      await this.token.purchase(editionNumber1, {from: account1, value: edition1Price}); // tokenId 100001
      await this.token.purchase(editionNumber2, {from: account1, value: edition2Price}); // tokenId 200001
    });

    describe('mint', function () {
      const thirdTokenId = 100002;

      beforeEach(async function () {
        await this.token.purchaseTo(account2, editionNumber1, {from: account2, value: edition1Price});
      });

      it(`adjusts owner tokens by index - [${firstTokenId}]`, async function () {
        const token = await this.token.tokenOfOwnerByIndex(account1, 0);
        token.toNumber().should.be.equal(firstTokenId);
      });

      it(`adjusts all tokens list - [${secondTokenId}]`, async function () {
        const newToken = await this.token.tokenByIndex(1);
        newToken.toNumber().should.be.equal(secondTokenId);
      });

      it('adjusts owner tokens by index', async function () {
        const token = await this.token.tokenOfOwnerByIndex(account2, 0);
        token.toNumber().should.be.equal(thirdTokenId);
      });

      it('adjusts all tokens list', async function () {
        const newToken = await this.token.tokenByIndex(2);
        newToken.toNumber().should.be.equal(thirdTokenId);
      });
    });

    describe('burn', function () {
      const sender = account1;

      beforeEach(async function () {
        await this.token.burn(firstTokenId, {from: _owner});
      });

      it('removes that token from the token list of the owner', async function () {
        const token = await this.token.tokenOfOwnerByIndex(sender, 0);
        token.toNumber().should.be.equal(secondTokenId);
      });

      it('adjusts all tokens list', async function () {
        const token = await this.token.tokenByIndex(0);
        token.toNumber().should.be.equal(secondTokenId);
      });

      it('burns all tokens', async function () {
        await this.token.burn(secondTokenId, {from: _owner});
        const total = await this.token.totalSupply();
        total.toNumber().should.be.equal(0);
        await assertRevert(this.token.tokenByIndex(0));
      });
    });

    describe('metadata', function () {
      const sampleUri = 'updatedTokenMetadata';

      it('has a name', async function () {
        const tokenName = await this.token.name();
        tokenName.should.be.equal(name);
      });

      it('has a symbol', async function () {
        const tokenSymbol = await this.token.symbol();
        tokenSymbol.should.be.equal(symbol);
      });

      it('sets and returns metadata for a token id', async function () {
        await this.token.setTokenURI(firstTokenId, sampleUri);
        const uri = await this.token.tokenURI(firstTokenId);
        uri.should.be.equal(`${BASE_URI}${sampleUri}`);
      });

      it('can burn token with metadata', async function () {
        await this.token.setTokenURI(firstTokenId, sampleUri);
        await this.token.burn(firstTokenId, {from: _owner});
        const exists = await this.token.exists(firstTokenId);
        exists.should.be.false;
      });

      it('returns setup metadata for token', async function () {
        const uri = await this.token.tokenURI(firstTokenId);
        uri.should.be.equal(`${BASE_URI}${editionTokenUri1}`);
      });

      it('reverts when querying metadata for non existent token id', async function () {
        await assertRevert(this.token.tokenURI(500));
      });
    });

    describe('totalSupply', function () {
      it('returns total token supply', async function () {
        const totalSupply = await this.token.totalSupply();
        totalSupply.should.be.eq.BN(2);
      });
    });

    describe('tokenOfOwnerByIndex', function () {
      const owner = account1;
      const another = account2;

      describe('when the given index is lower than the amount of tokens owned by the given address', function () {
        it('returns the token ID placed at the given index', async function () {
          const tokenId = await this.token.tokenOfOwnerByIndex(owner, 0);
          tokenId.should.be.eq.BN(firstTokenId);
        });
      });

      describe('when the index is greater than or equal to the total tokens owned by the given address', function () {
        it('reverts', async function () {
          await assertRevert(this.token.tokenOfOwnerByIndex(owner, 2));
        });
      });

      describe('when the given address does not own any token', function () {
        it('reverts', async function () {
          await assertRevert(this.token.tokenOfOwnerByIndex(another, 0));
        });
      });

      describe('after transferring all tokens to another user', function () {
        beforeEach(async function () {
          await this.token.transferFrom(owner, another, firstTokenId, {from: owner});
          await this.token.transferFrom(owner, another, secondTokenId, {from: owner});
        });

        it('returns correct token IDs for target', async function () {
          const count = await this.token.balanceOf(another);
          count.toNumber().should.be.equal(2);
          const tokensListed = await Promise.all(_.range(2).map(i => this.token.tokenOfOwnerByIndex(another, i)));
          tokensListed.map(t => t.toNumber()).should.have.members([firstTokenId, secondTokenId]);
        });

        it('returns empty collection for original owner', async function () {
          const count = await this.token.balanceOf(owner);
          count.toNumber().should.be.equal(0);
          await assertRevert(this.token.tokenOfOwnerByIndex(owner, 0));
        });
      });
    });

    describe('tokenByIndex', function () {
      it('should return all tokens', async function () {
        const tokensListed = await Promise.all(_.range(2).map(i => this.token.tokenByIndex(i)));
        tokensListed.map(t => t.toNumber()).should.have.members([firstTokenId, secondTokenId]);
      });

      it('should revert if index is greater than supply', async function () {
        await assertRevert(this.token.tokenByIndex(2));
      });

      [{
        tokenId: firstTokenId,
        edition: editionNumber1,
        value: edition1Price,
        newIds: [100002, 100003]
      }, {
        tokenId: secondTokenId,
        edition: editionNumber2,
        value: edition1Price,
        newIds: [200002, 200003]
      }].forEach(function ({tokenId, edition, value, newIds}) {
        it(`should return all tokens after burning token ${tokenId} and minting new tokens in edition ${edition}`, async function () {
          const from = account1;

          await this.token.burn(tokenId, {from: _owner});

          await this.token.purchase(edition, {from, value});
          await this.token.purchase(edition, {from, value});

          const count = await this.token.totalSupply();
          count.toNumber().should.be.equal(3);

          const tokensListed = await Promise.all(_.range(3).map(i => this.token.tokenByIndex(i)));

          const expectedTokens = _.filter(
            [firstTokenId, secondTokenId, ...newIds],
            x => (x !== tokenId)
          );
          const toNumberTokens = tokensListed.map(t => t.toNumber());
          toNumberTokens.should.have.members(expectedTokens);
        });
      });
    });
  });

  describe('like a mintable and burnable ERC721Token', function () {
    const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
    const firstTokenId = 100001;
    const secondTokenId = 200001;
    const thirdTokenId = 100002;
    const unknownTokenId = 99;
    const unknownEdition = 300000;
    const creator = account1;

    beforeEach(async function () {
      await this.token.purchaseTo(creator, editionNumber1, {from: creator, value: edition1Price});
      await this.token.purchaseTo(creator, editionNumber2, {from: creator, value: edition2Price});
    });

    describe('mint', function () {
      const to = account1;
      let logs = null;

      describe('when successful', function () {
        beforeEach(async function () {
          const result = await this.token.purchaseTo(to, editionNumber1, {value: edition1Price});
          logs = result.logs;
        });

        it('assigns the token to the new owner', async function () {
          const owner = await this.token.ownerOf(thirdTokenId);
          owner.should.be.equal(to);
        });

        it('increases the balance of its owner', async function () {
          const balance = await this.token.balanceOf(to);
          balance.should.be.eq.BN(3);
        });

        it('emits a transfer event', async function () {
          logs.length.should.be.equal(3);
          logs[0].event.should.be.equal('Transfer');
          logs[0].args._from.should.be.equal(ZERO_ADDRESS);
          logs[0].args._to.should.be.eq.BN(to);
          logs[0].args._tokenId.should.be.eq.BN(thirdTokenId);
        });
      });

      describe('when the given owner address is the zero address', function () {
        it('reverts', async function () {
          await assertRevert(this.token.purchaseTo(ZERO_ADDRESS, editionNumber1, {value: edition1Price}));
        });
      });

      describe('when the given token ID was NOT tracked by this contract', function () {
        it('reverts', async function () {
          await assertRevert(this.token.purchaseTo(account1, unknownEdition, {value: edition1Price}));
        });
      });
    });

    describe('burn', function () {
      const tokenId = firstTokenId;
      const sender = creator;
      let logs = null;

      describe('when successful', function () {
        beforeEach(async function () {
          const result = await this.token.burn(tokenId, {from: _owner});
          logs = result.logs;
        });

        it('burns the given token ID and adjusts the balance of the owner', async function () {
          await assertRevert(this.token.ownerOf(tokenId));
          const balance = await this.token.balanceOf(sender);
          balance.should.be.eq.BN(1);
        });

        it('emits a burn event', async function () {
          logs.length.should.be.equal(1);
          logs[0].event.should.be.equal('Transfer');
          logs[0].args._from.should.be.equal(sender);
          logs[0].args._to.should.be.equal(ZERO_ADDRESS);
          logs[0].args._tokenId.should.be.eq.BN(tokenId);
        });
      });

      describe('when there is a previous approval', function () {
        beforeEach(async function () {
          await this.token.approve(account2, tokenId, {from: sender});
          const result = await this.token.burn(tokenId, {from: _owner});
          logs = result.logs;
        });

        it('clears the approval', async function () {
          const approvedAccount = await this.token.getApproved(tokenId);
          approvedAccount.should.be.equal(ZERO_ADDRESS);
        });
      });

      describe('when the given token ID was not tracked by this contract', function () {
        it('reverts', async function () {
          await assertRevert(this.token.burn(unknownTokenId, {from: _owner}));
        });
      });
    });
  });

  describe('like an ERC721BasicToken', function () {
    const firstTokenId = 100001;
    const secondTokenId = 200001;
    const unknownTokenId = 9999;
    const creator = account1;
    const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
    const RECEIVER_MAGIC_VALUE = '0x150b7a02';

    beforeEach(async function () {
      await this.token.purchase(editionNumber1, {from: account1, value: edition1Price}); // tokenId 100001
      await this.token.purchase(editionNumber2, {from: account1, value: edition2Price}); // tokenId 200001
    });

    describe('balanceOf', function () {
      context('when the given address owns some tokens', function () {
        it('returns the amount of tokens owned by the given address', async function () {
          const balance = await this.token.balanceOf(creator);
          balance.should.be.eq.BN(2);
        });
      });

      context('when the given address does not own any tokens', function () {
        it('returns 0', async function () {
          const balance = await this.token.balanceOf(account2);
          balance.should.be.eq.BN(0);
        });
      });

      context('when querying the zero address', function () {
        it('throws', async function () {
          await assertRevert(this.token.balanceOf(ZERO_ADDRESS));
        });
      });
    });

    describe('exists', function () {
      context('when the token exists', function () {
        const tokenId = firstTokenId;

        it('should return true', async function () {
          const result = await this.token.exists(tokenId);
          result.should.be.true;
        });
      });

      context('when the token does not exist', function () {
        const tokenId = unknownTokenId;

        it('should return false', async function () {
          const result = await this.token.exists(tokenId);
          result.should.be.false;
        });
      });
    });

    describe('ownerOf', function () {
      context('when the given token ID was tracked by this token', function () {
        const tokenId = firstTokenId;

        it('returns the owner of the given token ID', async function () {
          const owner = await this.token.ownerOf(tokenId);
          owner.should.be.equal(creator);
        });
      });

      context('when the given token ID was not tracked by this token', function () {
        const tokenId = unknownTokenId;

        it('reverts', async function () {
          await assertRevert(this.token.ownerOf(tokenId));
        });
      });
    });

    describe('transfers', function () {
      const owner = account1;
      const approved = account2;
      const operator = accounts[3];
      const unauthorized = accounts[4];
      const tokenId = firstTokenId;
      const data = '0x42';

      let logs = null;

      beforeEach(async function () {
        this.to = accounts[5];
        await this.token.approve(approved, tokenId, {from: owner});
        await this.token.setApprovalForAll(operator, true, {from: owner});
      });

      const transferWasSuccessful = function ({owner, tokenId, approved}) {
        it('transfers the ownership of the given token ID to the given address', async function () {
          const newOwner = await this.token.ownerOf(tokenId);
          newOwner.should.be.equal(this.to);
        });

        it('clears the approval for the token ID', async function () {
          const approvedAccount = await this.token.getApproved(tokenId);
          approvedAccount.should.be.equal(ZERO_ADDRESS);
        });

        if (approved) {
          it('emit only a transfer event', async function () {
            logs.length.should.be.equal(1);
            logs[0].event.should.be.equal('Transfer');
            logs[0].args._from.should.be.equal(owner);
            logs[0].args._to.should.be.equal(this.to);
            logs[0].args._tokenId.should.be.eq.BN(tokenId);
          });
        } else {
          it('emits only a transfer event', async function () {
            logs.length.should.be.equal(1);
            logs[0].event.should.be.equal('Transfer');
            logs[0].args._from.should.be.equal(owner);
            logs[0].args._to.should.be.equal(this.to);
            logs[0].args._tokenId.should.be.eq.BN(tokenId);
          });
        }

        it('adjusts owners balances', async function () {
          const newOwnerBalance = await this.token.balanceOf(this.to);
          newOwnerBalance.should.be.eq.BN(1);

          const previousOwnerBalance = await this.token.balanceOf(owner);
          previousOwnerBalance.should.be.eq.BN(1);
        });

        it('adjusts owners tokens by index', async function () {
          if (!this.token.tokenOfOwnerByIndex) return;

          const newOwnerToken = await this.token.tokenOfOwnerByIndex(this.to, 0);
          newOwnerToken.toNumber().should.be.equal(tokenId);

          const previousOwnerToken = await this.token.tokenOfOwnerByIndex(owner, 0);
          previousOwnerToken.toNumber().should.not.be.equal(tokenId);
        });
      };

      const shouldTransferTokensByUsers = function (transferFunction) {
        context('when called by the owner', function () {
          beforeEach(async function () {
            ({logs} = await transferFunction.call(this, owner, this.to, tokenId, {from: owner}));
          });
          transferWasSuccessful({owner, tokenId, approved});
        });

        context('when called by the approved individual', function () {
          beforeEach(async function () {
            ({logs} = await transferFunction.call(this, owner, this.to, tokenId, {from: approved}));
          });
          transferWasSuccessful({owner, tokenId, approved});
        });

        context('when called by the operator', function () {
          beforeEach(async function () {
            ({logs} = await transferFunction.call(this, owner, this.to, tokenId, {from: operator}));
          });
          transferWasSuccessful({owner, tokenId, approved});
        });

        context('when called by the owner without an approved user', function () {
          beforeEach(async function () {
            await this.token.approve(ZERO_ADDRESS, tokenId, {from: owner});
            ({logs} = await transferFunction.call(this, owner, this.to, tokenId, {from: operator}));
          });
          transferWasSuccessful({owner, tokenId, approved: null});
        });

        context('when sent to the owner', function () {
          beforeEach(async function () {
            ({logs} = await transferFunction.call(this, owner, owner, tokenId, {from: owner}));
          });

          it('keeps ownership of the token', async function () {
            const newOwner = await this.token.ownerOf(tokenId);
            newOwner.should.be.equal(owner);
          });

          it('clears the approval for the token ID', async function () {
            const approvedAccount = await this.token.getApproved(tokenId);
            approvedAccount.should.be.equal(ZERO_ADDRESS);
          });

          it('emits only a transfer event', async function () {
            logs.length.should.be.equal(1);
            logs[0].event.should.be.equal('Transfer');
            logs[0].args._from.should.be.equal(owner);
            logs[0].args._to.should.be.equal(owner);
            logs[0].args._tokenId.should.be.eq.BN(tokenId);
          });

          it('keeps the owner balance', async function () {
            const ownerBalance = await this.token.balanceOf(owner);
            ownerBalance.should.be.eq.BN(2);
          });

          it('keeps same tokens by index', async function () {
            if (!this.token.tokenOfOwnerByIndex) return;
            const tokensListed = await Promise.all(_.range(2).map(i => this.token.tokenOfOwnerByIndex(owner, i)));
            tokensListed.map(t => t.toNumber()).should.have.members([firstTokenId, secondTokenId]);
          });
        });

        context('when the address of the previous owner is incorrect', function () {
          it('reverts', async function () {
            await assertRevert(transferFunction.call(this, unauthorized, this.to, tokenId, {from: owner}));
          });
        });

        context('when the sender is not authorized for the token id', function () {
          it('reverts', async function () {
            await assertRevert(transferFunction.call(this, owner, this.to, tokenId, {from: unauthorized}));
          });
        });

        context('when the given token ID does not exist', function () {
          it('reverts', async function () {
            await assertRevert(transferFunction.call(this, owner, this.to, unknownTokenId, {from: owner}));
          });
        });

        context('when the address to transfer the token to is the zero address', function () {
          it('reverts', async function () {
            await assertRevert(transferFunction.call(this, owner, ZERO_ADDRESS, tokenId, {from: owner}));
          });
        });
      };

      describe('via transferFrom', function () {
        shouldTransferTokensByUsers(function (from, to, tokenId, opts) {
          return this.token.transferFrom(from, to, tokenId, opts);
        });
      });

      describe('via safeTransferFrom', function () {
        const safeTransferFromWithData = function (from, to, tokenId, opts) {
          return sendTransaction(
            this.token,
            'safeTransferFrom',
            'address,address,uint256,bytes',
            [from, to, tokenId, data],
            opts
          );
        };

        const safeTransferFromWithoutData = function (from, to, tokenId, opts) {
          return this.token.safeTransferFrom(from, to, tokenId, opts);
        };

        const shouldTransferSafely = function (transferFun, data) {
          describe('to a user account', function () {
            shouldTransferTokensByUsers(transferFun);
          });

          describe('to a valid receiver contract', function () {
            beforeEach(async function () {
              this.receiver = await ERC721Receiver.new(RECEIVER_MAGIC_VALUE, false);
              this.to = this.receiver.address;
            });

            shouldTransferTokensByUsers(transferFun);

            it.skip('should call onERC721Received', async function () {
              const result = await transferFun.call(this, owner, this.to, tokenId, {from: owner});
              result.receipt.logs.length.should.be.equal(2);
              // FIXME - work out how to bring back decodeLogs()
              // const [log] = decodeLogs([result.receipt.logs[1]], ERC721Receiver, this.receiver.address);
              // log.event.should.be.eq('Received');
              // log.args._operator.should.be.equal(owner);
              // log.args._from.should.be.equal(owner);
              // log.args._tokenId.toNumber().should.be.equal(tokenId);
              // log.args._data.should.be.equal(data);
            });

            it.skip('should call onERC721Received from approved', async function () {
              const result = await transferFun.call(this, owner, this.to, tokenId, {from: approved});
              result.receipt.logs.length.should.be.equal(2);
              // FIXME - work out how to bring back decodeLogs()
              // const [log] = decodeLogs([result.receipt.logs[1]], ERC721Receiver, this.receiver.address);
              // log.event.should.be.eq('Received');
              // log.args._operator.should.be.equal(approved);
              // log.args._from.should.be.equal(owner);
              // log.args._tokenId.toNumber().should.be.equal(tokenId);
              // log.args._data.should.be.equal(data);
            });

            describe('with an invalid token id', function () {
              it('reverts', async function () {
                await assertRevert(
                  transferFun.call(
                    this,
                    owner,
                    this.to,
                    unknownTokenId,
                    {from: owner},
                  )
                );
              });
            });
          });
        };

        // TODO does truffle 5 change method overloading?
        describe.skip('with data', function () {
          shouldTransferSafely(safeTransferFromWithData, data);
        });

        describe('without data', function () {
          shouldTransferSafely(safeTransferFromWithoutData, '0x');
        });

        describe('to a receiver contract returning unexpected value', function () {
          it('reverts', async function () {
            const invalidReceiver = await ERC721Receiver.new('0x42', false);
            await assertRevert(this.token.safeTransferFrom(owner, invalidReceiver.address, tokenId, {from: owner}));
          });
        });

        describe('to a receiver contract that throws', function () {
          it('reverts', async function () {
            const invalidReceiver = await ERC721Receiver.new(RECEIVER_MAGIC_VALUE, true);
            await assertRevert(this.token.safeTransferFrom(owner, invalidReceiver.address, tokenId, {from: owner}));
          });
        });

        describe('to a contract that does not implement the required function', function () {
          it('reverts', async function () {
            const invalidReceiver = this.token;
            await assertRevert(this.token.safeTransferFrom(owner, invalidReceiver.address, tokenId, {from: owner}));
          });
        });
      });
    });

    describe('approve', function () {
      const tokenId = firstTokenId;
      const sender = account1;
      const to = account3;

      let logs = null;

      const itClearsApproval = function () {
        it('clears approval for the token', async function () {
          const approvedAccount = await this.token.getApproved(tokenId);
          approvedAccount.should.be.equal(ZERO_ADDRESS);
        });
      };

      const itApproves = function (address) {
        it('sets the approval for the target address', async function () {
          const approvedAccount = await this.token.getApproved(tokenId);
          approvedAccount.should.be.equal(address);
        });
      };

      const itEmitsApprovalEvent = function (address) {
        it('emits an approval event', async function () {
          logs.length.should.be.equal(1);
          logs[0].event.should.be.equal('Approval');
          logs[0].args._owner.should.be.equal(sender);
          logs[0].args._approved.should.be.equal(address);
          logs[0].args._tokenId.should.be.eq.BN(tokenId);
        });
      };

      context('when clearing approval', function () {
        context('when there was no prior approval', function () {
          beforeEach(async function () {
            ({logs} = await this.token.approve(ZERO_ADDRESS, tokenId, {from: sender}));
          });

          itClearsApproval();
          itEmitsApprovalEvent(ZERO_ADDRESS);
        });

        context('when there was a prior approval', function () {
          beforeEach(async function () {
            await this.token.approve(to, tokenId, {from: sender});
            ({logs} = await this.token.approve(ZERO_ADDRESS, tokenId, {from: sender}));
          });

          itClearsApproval();
          itEmitsApprovalEvent(ZERO_ADDRESS);
        });
      });

      context('when approving a non-zero address', function () {
        context('when there was no prior approval', function () {
          beforeEach(async function () {
            ({logs} = await this.token.approve(to, tokenId, {from: sender}));
          });

          itApproves(to);
          itEmitsApprovalEvent(to);
        });

        context('when there was a prior approval to the same address', function () {
          beforeEach(async function () {
            await this.token.approve(to, tokenId, {from: sender});
            ({logs} = await this.token.approve(to, tokenId, {from: sender}));
          });

          itApproves(to);
          itEmitsApprovalEvent(to);
        });

        context('when there was a prior approval to a different address', function () {
          beforeEach(async function () {
            await this.token.approve(accounts[2], tokenId, {from: sender});
            ({logs} = await this.token.approve(to, tokenId, {from: sender}));
          });

          itApproves(to);
          itEmitsApprovalEvent(to);
        });
      });

      context('when the address that receives the approval is the owner', function () {
        it('reverts', async function () {
          await assertRevert(this.token.approve(sender, tokenId, {from: sender}));
        });
      });

      context('when the sender does not own the given token ID', function () {
        it('reverts', async function () {
          await assertRevert(this.token.approve(to, tokenId, {from: accounts[2]}));
        });
      });

      context('when the sender is approved for the given token ID', function () {
        it('reverts', async function () {
          await this.token.approve(accounts[2], tokenId, {from: sender});
          await assertRevert(this.token.approve(to, tokenId, {from: accounts[2]}));
        });
      });

      context('when the sender is an operator', function () {
        const operator = accounts[2];
        beforeEach(async function () {
          await this.token.setApprovalForAll(operator, true, {from: sender});
          ({logs} = await this.token.approve(to, tokenId, {from: operator}));
        });

        itApproves(to);
        itEmitsApprovalEvent(to);
      });

      context('when the given token ID does not exist', function () {
        it('reverts', async function () {
          await assertRevert(this.token.approve(to, unknownTokenId, {from: sender}));
        });
      });
    });

    describe('setApprovalForAll', function () {
      const sender = account1;

      context('when the operator willing to approve is not the owner', function () {
        const operator = account2;

        context('when there is no operator approval set by the sender', function () {
          it('approves the operator', async function () {
            await this.token.setApprovalForAll(operator, true, {from: sender});

            const isApproved = await this.token.isApprovedForAll(sender, operator);
            isApproved.should.be.true;
          });

          it('emits an approval event', async function () {
            const {logs} = await this.token.setApprovalForAll(operator, true, {from: sender});

            logs.length.should.be.equal(1);
            logs[0].event.should.be.equal('ApprovalForAll');
            logs[0].args._owner.should.be.equal(sender);
            logs[0].args._operator.should.be.equal(operator);
            logs[0].args._approved.should.be.true;
          });
        });

        context('when the operator was set as not approved', function () {
          beforeEach(async function () {
            await this.token.setApprovalForAll(operator, false, {from: sender});
          });

          it('approves the operator', async function () {
            await this.token.setApprovalForAll(operator, true, {from: sender});

            const isApproved = await this.token.isApprovedForAll(sender, operator);
            isApproved.should.be.true;
          });

          it('emits an approval event', async function () {
            const {logs} = await this.token.setApprovalForAll(operator, true, {from: sender});

            logs.length.should.be.equal(1);
            logs[0].event.should.be.equal('ApprovalForAll');
            logs[0].args._owner.should.be.equal(sender);
            logs[0].args._operator.should.be.equal(operator);
            logs[0].args._approved.should.be.true;
          });

          it('can unset the operator approval', async function () {
            await this.token.setApprovalForAll(operator, false, {from: sender});

            const isApproved = await this.token.isApprovedForAll(sender, operator);
            isApproved.should.be.false;
          });
        });

        context('when the operator was already approved', function () {
          beforeEach(async function () {
            await this.token.setApprovalForAll(operator, true, {from: sender});
          });

          it('keeps the approval to the given address', async function () {
            await this.token.setApprovalForAll(operator, true, {from: sender});

            const isApproved = await this.token.isApprovedForAll(sender, operator);
            isApproved.should.be.true;
          });

          it('emits an approval event', async function () {
            const {logs} = await this.token.setApprovalForAll(operator, true, {from: sender});

            logs.length.should.be.equal(1);
            logs[0].event.should.be.equal('ApprovalForAll');
            logs[0].args._owner.should.be.equal(sender);
            logs[0].args._operator.should.be.equal(operator);
            logs[0].args._approved.should.be.true;
          });
        });
      });

      context('when the operator is the owner', function () {
        const operator = creator;

        it('reverts', async function () {
          await assertRevert(this.token.setApprovalForAll(operator, true, {from: sender}));
        });
      });
    });

    shouldSupportInterfaces([
      'ERC165',
      'ERC721',
      'ERC721Exists',
    ]);
  });

  shouldSupportInterfaces([
    'ERC165',
    'ERC721',
    'ERC721Exists',
    'ERC721Enumerable',
    'ERC721Metadata',
  ]);

});
