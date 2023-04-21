/* eslint-disable camelcase */
import { ethers } from 'hardhat'
import { Signer, Contract, constants, BigNumber } from 'ethers'
import { smock, FakeContract, MockContract } from '@defi-wonderland/smock'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
import * as L1CrossDomainMessenger from '@eth-optimism/contracts/artifacts/contracts/L1/messaging/L1CrossDomainMessenger.sol/L1CrossDomainMessenger.json'
import { expect } from 'chai'
import {
  REGISTRY_DEPLOY_TX,
  REGISTRY_DEPLOYER_ADDRESS,
  NON_NULL_BYTES32,
  NON_ZERO_ADDRESS,
} from './utils/constants'
import { deployFromName, getContractInterface } from './utils/contracts'
import { ERROR_STRINGS } from './utils/errors'

const DUMMY_L2_ERC20_ADDRESS = '0xaBBAABbaaBbAABbaABbAABbAABbaAbbaaBbaaBBa'
const DUMMY_L2_BRIDGE_ADDRESS = '0xACDCacDcACdCaCDcacdcacdCaCdcACdCAcDcaCdc'
const DUMMY_L1_ERC20_ADDRESS = '0xACDCacDcACdCaCDcacdcacdCaCdcACdCAcDcaCdc'
const DUMMY_PROXY_ADMIN_ADDRESS = '0x1234512345123451234512345123451234512345'
const DUMMY_UPGRADER_ADDRESS = '0xACDCacDcACdCaCDcacdcacdCaCdcACdCAcDcaCdc'
const INITIAL_INFLATION_MULTIPLIER = BigNumber.from('1000000000000000000')
// 2e18
const INITIAL_TOTAL_L1_SUPPLY = BigNumber.from('2000000000000000000')
const FINALIZATION_GAS = 1_200_000

describe.only('L1ECOBridge', () => {
  let l1MessengerImpersonator: Signer
  let alice: SignerWithAddress
  let bob: SignerWithAddress

  before(async () => {
    ;[l1MessengerImpersonator, alice, bob] = await ethers.getSigners()
    await (
      await alice.sendTransaction({
        to: REGISTRY_DEPLOYER_ADDRESS,
        value: ethers.utils.parseEther('0.08'),
      })
    ).wait()
    if (alice.provider) {
      await (await alice.provider.sendTransaction(REGISTRY_DEPLOY_TX)).wait()
    }
  })

  let L1ERC20: MockContract<Contract>
  let L1ECOBridge: Contract
  let Fake__L1CrossDomainMessenger: FakeContract
  beforeEach(async () => {
    // Get a new mock L1 messenger
    Fake__L1CrossDomainMessenger = await smock.fake<Contract>(
      L1CrossDomainMessenger.abi,
      { address: await l1MessengerImpersonator.getAddress() } // This allows us to use an ethers override {from: Mock__L2CrossDomainMessenger.address} to mock calls
    )

    L1ERC20 = await (
      await smock.mock(
        '@helix-foundation/currency/contracts/currency/ECO.sol:ECO'
      )
    ).deploy(
      DUMMY_L1_ERC20_ADDRESS,
      alice.address,
      ethers.utils.parseEther('10000'),
      alice.address
    )

    await L1ERC20.setVariable('_balances', {
      [alice.address]: INITIAL_TOTAL_L1_SUPPLY.mul(
        INITIAL_INFLATION_MULTIPLIER
      ),
    })
    await L1ERC20.setVariable('checkpoints', {
      [alice.address]: [
        {
          fromBlock: 0,
          value: INITIAL_TOTAL_L1_SUPPLY.mul(INITIAL_INFLATION_MULTIPLIER),
        },
      ],
    })

    // Deploy the bridge
    L1ECOBridge = await (await smock.mock('L1ECOBridge')).deploy()
    await L1ECOBridge.setVariable('_initializing', false)
    await L1ECOBridge.connect(alice).initialize(
      Fake__L1CrossDomainMessenger.address,
      DUMMY_L2_BRIDGE_ADDRESS,
      L1ERC20.address,
      DUMMY_PROXY_ADMIN_ADDRESS,
      alice.address
    )
  })

  describe('ERC20 deposits', () => {
    //  .5e18
    const depositAmount = INITIAL_TOTAL_L1_SUPPLY.div(4)

    beforeEach(async () => {
      await L1ERC20.connect(alice).approve(L1ECOBridge.address, depositAmount)
    })

    it('depositERC20() escrows the deposit amount and sends the correct deposit message', async () => {
      expect(await L1ERC20.balanceOf(alice.address)).to.equal(
        INITIAL_TOTAL_L1_SUPPLY
      )

      await L1ECOBridge.connect(alice).depositERC20(
        L1ERC20.address,
        DUMMY_L2_ERC20_ADDRESS,
        depositAmount,
        FINALIZATION_GAS,
        NON_NULL_BYTES32
      )

      expect(
        Fake__L1CrossDomainMessenger.sendMessage.getCall(0).args
      ).to.deep.equal([
        DUMMY_L2_BRIDGE_ADDRESS,
        (await getContractInterface('IL2ECOBridge')).encodeFunctionData(
          'finalizeDeposit',
          [
            L1ERC20.address,
            DUMMY_L2_ERC20_ADDRESS,
            alice.address,
            alice.address,
            depositAmount.mul(INITIAL_INFLATION_MULTIPLIER),
            NON_NULL_BYTES32,
          ]
        ),
        FINALIZATION_GAS,
      ])

      expect(await L1ERC20.balanceOf(alice.address)).to.equal(
        INITIAL_TOTAL_L1_SUPPLY.sub(depositAmount)
      )

      expect(await L1ERC20.balanceOf(L1ECOBridge.address)).to.equal(
        depositAmount
      )
    })

    it('depositERC20To() escrows the deposit amount and sends the correct deposit message', async () => {
      await L1ECOBridge.connect(alice).depositERC20To(
        L1ERC20.address,
        DUMMY_L2_ERC20_ADDRESS,
        bob.address,
        depositAmount,
        FINALIZATION_GAS,
        NON_NULL_BYTES32
      )

      expect(
        Fake__L1CrossDomainMessenger.sendMessage.getCall(0).args
      ).to.deep.equal([
        DUMMY_L2_BRIDGE_ADDRESS,
        (await getContractInterface('IL2ECOBridge')).encodeFunctionData(
          'finalizeDeposit',
          [
            L1ERC20.address,
            DUMMY_L2_ERC20_ADDRESS,
            alice.address,
            bob.address,
            depositAmount.mul(INITIAL_INFLATION_MULTIPLIER),
            NON_NULL_BYTES32,
          ]
        ),
        FINALIZATION_GAS,
      ])

      expect(await L1ERC20.balanceOf(alice.address)).to.equal(
        INITIAL_TOTAL_L1_SUPPLY.sub(depositAmount)
      )

      expect(await L1ERC20.balanceOf(L1ECOBridge.address)).to.equal(
        depositAmount
      )
    })

    it('cannot depositERC20 from a contract account', async () => {
      expect(
        L1ECOBridge.depositERC20(
          L1ERC20.address,
          DUMMY_L2_ERC20_ADDRESS,
          depositAmount,
          FINALIZATION_GAS,
          NON_NULL_BYTES32
        )
      ).to.be.revertedWith('Account not EOA')
    })
  })

  describe('ERC20 withdrawals', () => {
    it('onlyFromCrossDomainAccount: should revert on calls from a non-crossDomainMessenger L1 account', async () => {
      await expect(
        L1ECOBridge.connect(alice).finalizeERC20Withdrawal(
          L1ERC20.address,
          DUMMY_L2_ERC20_ADDRESS,
          constants.AddressZero,
          constants.AddressZero,
          1,
          NON_NULL_BYTES32
        )
      ).to.be.revertedWith(ERROR_STRINGS.OVM.INVALID_MESSENGER)
    })

    it('onlyFromCrossDomainAccount: should revert on calls from the right crossDomainMessenger, but wrong xDomainMessageSender (ie. not the L2DepositedERC20)', async () => {
      Fake__L1CrossDomainMessenger.xDomainMessageSender.returns(
        NON_ZERO_ADDRESS
      )

      await expect(
        L1ECOBridge.finalizeERC20Withdrawal(
          L1ERC20.address,
          DUMMY_L2_ERC20_ADDRESS,
          constants.AddressZero,
          constants.AddressZero,
          1,
          NON_NULL_BYTES32,
          {
            from: Fake__L1CrossDomainMessenger.address,
          }
        )
      ).to.be.revertedWith(ERROR_STRINGS.OVM.INVALID_X_DOMAIN_MSG_SENDER)
    })

    it('should credit funds to the withdrawer and not use too much gas', async () => {
      // First Alice will 'donate' some tokens so that there's a balance to be withdrawn
      const withdrawalAmount = INITIAL_TOTAL_L1_SUPPLY
      await L1ERC20.connect(alice).approve(
        L1ECOBridge.address,
        withdrawalAmount
      )

      await L1ECOBridge.connect(alice).depositERC20(
        L1ERC20.address,
        DUMMY_L2_ERC20_ADDRESS,
        withdrawalAmount,
        FINALIZATION_GAS,
        NON_NULL_BYTES32
      )

      expect(await L1ERC20.balanceOf(L1ECOBridge.address)).to.be.equal(
        withdrawalAmount
      )

      // make sure no balance at start of test
      expect(await L1ERC20.balanceOf(NON_ZERO_ADDRESS)).to.be.equal(0)

      Fake__L1CrossDomainMessenger.xDomainMessageSender.returns(
        DUMMY_L2_BRIDGE_ADDRESS
      )

      await L1ECOBridge.finalizeERC20Withdrawal(
        L1ERC20.address,
        DUMMY_L2_ERC20_ADDRESS,
        NON_ZERO_ADDRESS,
        NON_ZERO_ADDRESS,
        withdrawalAmount.mul(INITIAL_INFLATION_MULTIPLIER),
        NON_NULL_BYTES32,
        { from: Fake__L1CrossDomainMessenger.address }
      )

      expect(await L1ERC20.balanceOf(NON_ZERO_ADDRESS)).to.be.equal(
        withdrawalAmount
      )
    })
  })

  describe('upgrades to L2 contract', () => {
    it("should revert if caller isn't upgrader", async () => {
      await expect(
        L1ECOBridge.connect(bob).upgradeECO(
          DUMMY_L2_ERC20_ADDRESS,
          FINALIZATION_GAS
        )
      ).to.be.revertedWith(ERROR_STRINGS.L1ECOBridge.UNAUTHORIZED_UPGRADER)
    })

    it('should succeed to send the correct argumnents', async () => {
      await L1ECOBridge.connect(alice).upgradeECO(
        DUMMY_L2_ERC20_ADDRESS,
        FINALIZATION_GAS
      )

      expect(
        Fake__L1CrossDomainMessenger.sendMessage.getCall(0).args
      ).to.deep.equal([
        DUMMY_L2_BRIDGE_ADDRESS,
        (await getContractInterface('L2ECOBridge')).encodeFunctionData(
          'upgradeECO',
          [DUMMY_L2_ERC20_ADDRESS]
        ),
        FINALIZATION_GAS,
      ])
    })

    it('should succeed and emit an event', async () => {
      await expect(
        L1ECOBridge.connect(alice).upgradeECO(
          DUMMY_L2_ERC20_ADDRESS,
          FINALIZATION_GAS
        )
      )
        .to.emit(L1ECOBridge, 'UpgradeL2ECO')
        .withArgs(DUMMY_L2_ERC20_ADDRESS)
    })
  })

  describe('does a rebase', () => {
    it('should fetch the inflation multiplier', async () => {
      expect(await L1ECOBridge.inflationMultiplier()).to.eq(
        INITIAL_INFLATION_MULTIPLIER
      )

      const newInflationMultiplier = INITIAL_INFLATION_MULTIPLIER.div(2)

      if (alice.provider) {
        await L1ERC20.setVariable('_linearInflationCheckpoints', [
          {
            fromBlock: (await alice.provider.getBlock('latest')).number,
            value: newInflationMultiplier,
          },
        ])
      }
      await L1ECOBridge.connect(alice).rebase(FINALIZATION_GAS)
      expect(await L1ECOBridge.inflationMultiplier()).to.eq(
        newInflationMultiplier
      )

      expect(
        Fake__L1CrossDomainMessenger.sendMessage.getCall(0).args
      ).to.deep.equal([
        DUMMY_L2_BRIDGE_ADDRESS,
        (await getContractInterface('L2ECOBridge')).encodeFunctionData(
          'rebase',
          [newInflationMultiplier]
        ),
        FINALIZATION_GAS,
      ])
    })
  })
})
