import { ethers } from 'hardhat'
import { Contract } from 'ethers'
import { smock, FakeContract, MockContract } from '@defi-wonderland/smock'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'

import * as L2CrossDomainMessenger from '@eth-optimism/contracts/artifacts/contracts/L2/messaging/L2CrossDomainMessenger.sol/L2CrossDomainMessenger.json'
import * as L2StandardERC20 from '@eth-optimism/contracts/artifacts/contracts/standards/L2StandardERC20.sol/L2StandardERC20.json'

import { expect } from './tools/setup'
import { NON_NULL_BYTES32, NON_ZERO_ADDRESS } from './tools/constants'
import { getContractInterface, deployFromABI, deployFromName } from './tools/contracts'

// TODO: Maybe we should consider automatically generating these and exporting them?
const ERROR_STRINGS = {
  INVALID_MESSENGER: 'OVM_XCHAIN: messenger contract unauthenticated',
  INVALID_X_DOMAIN_MSG_SENDER:
    'OVM_XCHAIN: wrong sender of cross-domain message',
}

const DUMMY_L1_ERC20_ADDRESS = '0xaBBAABbaaBbAABbaABbAABbAABbaAbbaaBbaaBBa'
const DUMMY_L1_BRIDGE_ADDRESS = '0xACDCacDcACdCaCDcacdcacdCaCdcACdCAcDcaCdc'

describe('L2ECOBridge', () => {
  const INITIAL_TOTAL_SUPPLY = 100_000
  const ALICE_INITIAL_BALANCE = 50_000

  let alice: SignerWithAddress
  let bob: SignerWithAddress
  let l2MessengerImpersonator: SignerWithAddress
  before(async () => {
    // Create a special signer which will enable us to send messages from the L2Messenger contract
    ;[alice, bob, l2MessengerImpersonator] = await ethers.getSigners()
  })

  let L2ECOBridge: Contract
  let L2ECO: Contract
  let Fake__L2CrossDomainMessenger: FakeContract
  beforeEach(async () => {
    // Get a new mock L2 messenger
    Fake__L2CrossDomainMessenger = await smock.fake<Contract>(
      L2CrossDomainMessenger.abi,
      // This allows us to use an ethers override {from: Mock__L2CrossDomainMessenger.address} to mock calls
      { address: await l2MessengerImpersonator.getAddress() }
    )

    // Deploy the contract under test
    L2ECOBridge = await deployFromName('L2ECOBridge', {
      args: [Fake__L2CrossDomainMessenger.address, DUMMY_L1_BRIDGE_ADDRESS],
    })

    // Deploy an L2 ERC20
    L2ECO = await deployFromABI(L2StandardERC20, {
      args: [
        L2ECOBridge.address,
        DUMMY_L1_ERC20_ADDRESS,
        'L2Token',
        'L2T',
      ],
    })
  })

  // test the transfer flow of moving a token from L2 to L1
  describe('finalizeDeposit', () => {
    it('onlyFromCrossDomainAccount: should revert on calls from a non-crossDomainMessenger L2 account', async () => {
      await expect(
        L2ECOBridge.finalizeDeposit(
          DUMMY_L1_ERC20_ADDRESS,
          NON_ZERO_ADDRESS,
          NON_ZERO_ADDRESS,
          NON_ZERO_ADDRESS,
          0,
          NON_NULL_BYTES32
        )
      ).to.be.revertedWith(ERROR_STRINGS.INVALID_MESSENGER)
    })

    it('onlyFromCrossDomainAccount: should revert on calls from the right crossDomainMessenger, but wrong xDomainMessageSender (ie. not the L1ECOBridge)', async () => {
      Fake__L2CrossDomainMessenger.xDomainMessageSender.returns(
        NON_ZERO_ADDRESS
      )

      await expect(
        L2ECOBridge.connect(l2MessengerImpersonator).finalizeDeposit(
          DUMMY_L1_ERC20_ADDRESS,
          NON_ZERO_ADDRESS,
          NON_ZERO_ADDRESS,
          NON_ZERO_ADDRESS,
          0,
          NON_NULL_BYTES32,
          {
            from: Fake__L2CrossDomainMessenger.address,
          }
        )
      ).to.be.revertedWith(ERROR_STRINGS.INVALID_X_DOMAIN_MSG_SENDER)
    })

    it('should credit funds to the depositor', async () => {
      const depositAmount = 100

      Fake__L2CrossDomainMessenger.xDomainMessageSender.returns(
        DUMMY_L1_BRIDGE_ADDRESS
      )

      await L2ECOBridge.connect(l2MessengerImpersonator).finalizeDeposit(
        DUMMY_L1_ERC20_ADDRESS,
        L2ECO.address,
        alice.address,
        bob.address,
        depositAmount,
        NON_NULL_BYTES32,
        {
          from: Fake__L2CrossDomainMessenger.address,
        }
      )

      expect(await L2ECO.balanceOf(bob.address)).to.equal(depositAmount)
    })
  })

  describe('withdrawals', () => {
    const withdrawAmount = 1_000

    let Mock__L2Token: MockContract<Contract>
    beforeEach(async () => {
      // Deploy a smodded gateway so we can give some balances to withdraw
      Mock__L2Token = await (
        await smock.mock('L2StandardERC20')
      ).deploy(
        L2ECOBridge.address,
        DUMMY_L1_ERC20_ADDRESS,
        'L2Token',
        'L2T',
      )

      await Mock__L2Token.setVariable('_totalSupply', INITIAL_TOTAL_SUPPLY)
      await Mock__L2Token.setVariable('_balances', {
        [alice.address]: ALICE_INITIAL_BALANCE,
      })
      await Mock__L2Token.setVariable('l2Bridge', L2ECOBridge.address)
    })

    it('withdraw() burns and sends the correct withdrawal message', async () => {
      await L2ECOBridge.withdraw(
        Mock__L2Token.address,
        withdrawAmount,
        0,
        NON_NULL_BYTES32
      )

      expect(
        Fake__L2CrossDomainMessenger.sendMessage.getCall(0).args
      ).to.deep.equal([
        DUMMY_L1_BRIDGE_ADDRESS,
        (await getContractInterface('L1ECOBridge')).encodeFunctionData(
          'finalizeERC20Withdrawal',
          [
            DUMMY_L1_ERC20_ADDRESS,
            Mock__L2Token.address,
            alice.address,
            alice.address,
            withdrawAmount,
            NON_NULL_BYTES32,
          ]
        ),
        0,
      ])

      // Assert Alice's balance went down
      expect(await Mock__L2Token.balanceOf(alice.address)).to.deep.equal(
        ethers.BigNumber.from(ALICE_INITIAL_BALANCE - withdrawAmount)
      )

      // Assert totalSupply went down
      expect(await Mock__L2Token.totalSupply()).to.deep.equal(
        ethers.BigNumber.from(INITIAL_TOTAL_SUPPLY - withdrawAmount)
      )
    })

    it('withdrawTo() burns and sends the correct withdrawal message', async () => {
      await L2ECOBridge.withdrawTo(
        Mock__L2Token.address,
        bob.address,
        withdrawAmount,
        0,
        NON_NULL_BYTES32
      )

      expect(
        Fake__L2CrossDomainMessenger.sendMessage.getCall(0).args
      ).to.deep.equal([
        DUMMY_L1_BRIDGE_ADDRESS,
        (await getContractInterface('L1ECOBridge')).encodeFunctionData(
          'finalizeERC20Withdrawal',
          [
            DUMMY_L1_ERC20_ADDRESS,
            Mock__L2Token.address,
            alice.address,
            bob.address,
            withdrawAmount,
            NON_NULL_BYTES32,
          ]
        ),
        0,
      ])

      // Assert Alice's balance went down
      expect(await Mock__L2Token.balanceOf(alice.address)).to.deep.equal(
        ethers.BigNumber.from(ALICE_INITIAL_BALANCE - withdrawAmount)
      )

      // Assert totalSupply went down
      expect(await Mock__L2Token.totalSupply()).to.deep.equal(
        ethers.BigNumber.from(INITIAL_TOTAL_SUPPLY - withdrawAmount)
      )
    })
  })

})