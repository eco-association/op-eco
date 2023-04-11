import { ethers } from 'hardhat'
import { Signer, Contract, constants, BigNumber } from 'ethers'
import { smock, FakeContract, MockContract } from '@defi-wonderland/smock'
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers'
// import { TransparentUpgradeableProxy } from '@openzeppelin/contracts/proxy/transparent/TransparentUpgradeableProxy.sol'

import * as L1CrossDomainMessenger from '@eth-optimism/contracts/artifacts/contracts/L1/messaging/L1CrossDomainMessenger.sol/L1CrossDomainMessenger.json'
import * as ProxyJson from '@openzeppelin/contracts/build/contracts/TransparentUpgradeableProxy.json'

import { expect } from './tools/setup'
import { NON_NULL_BYTES32, NON_ZERO_ADDRESS } from './tools/constants'
import { deployFromName, getContractInterface } from './tools/contracts'
import { hrtime } from 'process'

// TODO: Maybe we should consider automatically generating these and exporting them?
const ERROR_STRINGS = {
  INVALID_MESSENGER: 'OVM_XCHAIN: messenger contract unauthenticated',
  INVALID_X_DOMAIN_MSG_SENDER:
    'OVM_XCHAIN: wrong sender of cross-domain message',
  ALREADY_INITIALIZED: 'Contract has already been initialized.',
  NOT_UPGRADER: 'Caller not authorized to upgrade L2 contracts.',
}

const DUMMY_L2_ERC20_ADDRESS = '0xaBBAABbaaBbAABbaABbAABbAABbaAbbaaBbaaBBa'
const DUMMY_L2_BRIDGE_ADDRESS = '0xACDCacDcACdCaCDcacdcacdCaCdcACdCAcDcaCdc'
const DUMMY_L1_ERC20_ADDRESS = '0xACDCacDcACdCaCDcacdcacdCaCdcACdCAcDcaCdc'
const DUMMY_UPGRADER_ADDRESS = '0xACDCacDcACdCaCDcacdcacdCaCdcACdCAcDcaCdc'
// 2e36
const INITIAL_TOTAL_L1_SUPPLY = BigNumber.from("2000000000000000000000000000000000000")
const FINALIZATION_GAS = 1_200_000

const REGISTRY_DEPLOY_TX =
  '0xf90a388085174876e800830c35008080b909e5608060405234801561001057600080fd5b506109c5806100206000396000f3fe608060405234801561001057600080fd5b50600436106100a5576000357c010000000000000000000000000000000000000000000000000000000090048063a41e7d5111610078578063a41e7d51146101d4578063aabbb8ca1461020a578063b705676514610236578063f712f3e814610280576100a5565b806329965a1d146100aa5780633d584063146100e25780635df8122f1461012457806365ba36c114610152575b600080fd5b6100e0600480360360608110156100c057600080fd5b50600160a060020a038135811691602081013591604090910135166102b6565b005b610108600480360360208110156100f857600080fd5b5035600160a060020a0316610570565b60408051600160a060020a039092168252519081900360200190f35b6100e06004803603604081101561013a57600080fd5b50600160a060020a03813581169160200135166105bc565b6101c26004803603602081101561016857600080fd5b81019060208101813564010000000081111561018357600080fd5b82018360208201111561019557600080fd5b803590602001918460018302840111640100000000831117156101b757600080fd5b5090925090506106b3565b60408051918252519081900360200190f35b6100e0600480360360408110156101ea57600080fd5b508035600160a060020a03169060200135600160e060020a0319166106ee565b6101086004803603604081101561022057600080fd5b50600160a060020a038135169060200135610778565b61026c6004803603604081101561024c57600080fd5b508035600160a060020a03169060200135600160e060020a0319166107ef565b604080519115158252519081900360200190f35b61026c6004803603604081101561029657600080fd5b508035600160a060020a03169060200135600160e060020a0319166108aa565b6000600160a060020a038416156102cd57836102cf565b335b9050336102db82610570565b600160a060020a031614610339576040805160e560020a62461bcd02815260206004820152600f60248201527f4e6f7420746865206d616e616765720000000000000000000000000000000000604482015290519081900360640190fd5b6103428361092a565b15610397576040805160e560020a62461bcd02815260206004820152601a60248201527f4d757374206e6f7420626520616e204552433136352068617368000000000000604482015290519081900360640190fd5b600160a060020a038216158015906103b85750600160a060020a0382163314155b156104ff5760405160200180807f455243313832305f4143434550545f4d4147494300000000000000000000000081525060140190506040516020818303038152906040528051906020012082600160a060020a031663249cb3fa85846040518363ffffffff167c01000000000000000000000000000000000000000000000000000000000281526004018083815260200182600160a060020a0316600160a060020a031681526020019250505060206040518083038186803b15801561047e57600080fd5b505afa158015610492573d6000803e3d6000fd5b505050506040513d60208110156104a857600080fd5b5051146104ff576040805160e560020a62461bcd02815260206004820181905260248201527f446f6573206e6f7420696d706c656d656e742074686520696e74657266616365604482015290519081900360640190fd5b600160a060020a03818116600081815260208181526040808320888452909152808220805473ffffffffffffffffffffffffffffffffffffffff19169487169485179055518692917f93baa6efbd2244243bfee6ce4cfdd1d04fc4c0e9a786abd3a41313bd352db15391a450505050565b600160a060020a03818116600090815260016020526040812054909116151561059a5750806105b7565b50600160a060020a03808216600090815260016020526040902054165b919050565b336105c683610570565b600160a060020a031614610624576040805160e560020a62461bcd02815260206004820152600f60248201527f4e6f7420746865206d616e616765720000000000000000000000000000000000604482015290519081900360640190fd5b81600160a060020a031681600160a060020a0316146106435780610646565b60005b600160a060020a03838116600081815260016020526040808220805473ffffffffffffffffffffffffffffffffffffffff19169585169590951790945592519184169290917f605c2dbf762e5f7d60a546d42e7205dcb1b011ebc62a61736a57c9089d3a43509190a35050565b600082826040516020018083838082843780830192505050925050506040516020818303038152906040528051906020012090505b92915050565b6106f882826107ef565b610703576000610705565b815b600160a060020a03928316600081815260208181526040808320600160e060020a031996909616808452958252808320805473ffffffffffffffffffffffffffffffffffffffff19169590971694909417909555908152600284528181209281529190925220805460ff19166001179055565b600080600160a060020a038416156107905783610792565b335b905061079d8361092a565b156107c357826107ad82826108aa565b6107b85760006107ba565b815b925050506106e8565b600160a060020a0390811660009081526020818152604080832086845290915290205416905092915050565b6000808061081d857f01ffc9a70000000000000000000000000000000000000000000000000000000061094c565b909250905081158061082d575080155b1561083d576000925050506106e8565b61084f85600160e060020a031961094c565b909250905081158061086057508015155b15610870576000925050506106e8565b61087a858561094c565b909250905060018214801561088f5750806001145b1561089f576001925050506106e8565b506000949350505050565b600160a060020a0382166000908152600260209081526040808320600160e060020a03198516845290915281205460ff1615156108f2576108eb83836107ef565b90506106e8565b50600160a060020a03808316600081815260208181526040808320600160e060020a0319871684529091529020549091161492915050565b7bffffffffffffffffffffffffffffffffffffffffffffffffffffffff161590565b6040517f01ffc9a7000000000000000000000000000000000000000000000000000000008082526004820183905260009182919060208160248189617530fa90519096909550935050505056fea165627a7a72305820377f4a2d4301ede9949f163f319021a6e9c687c292a5e2b2c4734c126b524e6c00291ba01820182018201820182018201820182018201820182018201820182018201820a01820182018201820182018201820182018201820182018201820182018201820'

describe('L1ECOBridge', () => {
  let l1MessengerImpersonator: Signer
  let alice: SignerWithAddress
  let bob: SignerWithAddress
  let upgraderImpersonator: SignerWithAddress
  // let ECO: M<
  let policy: MockContract<Contract>
  before(async () => {
    ;[l1MessengerImpersonator, alice, bob, upgraderImpersonator] = await ethers.getSigners()
    await (
      await alice.sendTransaction({
        to: '0xa990077c3205cbDf861e17Fa532eeB069cE9fF96',
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

    // policy = await (
    //   await smock.mock('@helix-foundation/currency/')
    // ).deploy(DUMMY_L1_ERC20_ADDRESS, alice.address, 1000, alice.address)


    L1ERC20 = await (
      await smock.mock('@helix-foundation/currency/contracts/currency/ECO.sol:ECO')
    ).deploy(DUMMY_L1_ERC20_ADDRESS, alice.address, ethers.utils.parseEther('10000'), alice.address)
    // L1ERC20 = await (
    //   await smock.mock('@openzeppelin/contracts/token/ERC20/ERC20.sol:ERC20')
    // ).deploy('L1ERC20', 'ERC')

    await L1ERC20.setVariable('_totalSupply', INITIAL_TOTAL_L1_SUPPLY)
    console.log(`totalsupply:    ${await L1ERC20.totalSupply()}`)
    // await L1ERC20.setVariable('INITIAL_INFLATION_MULTIPLIER', INITIAL_INFLATION_MULTIPLIER)
    await L1ERC20.setVariable('_balances', {
      [alice.address]: INITIAL_TOTAL_L1_SUPPLY,
    })

    // Deploy the contract under test
    L1ECOBridge = await deployFromName('L1ECOBridge')
    await L1ECOBridge.connect(alice).initialize(
      Fake__L1CrossDomainMessenger.address,
      DUMMY_L2_BRIDGE_ADDRESS,
      L1ERC20.address,
      alice.address
    )
  })

  describe('initialize', () => {
    it('Should only be callable once', async () => {
      await expect(
        L1ECOBridge.initialize(
          Fake__L1CrossDomainMessenger.address,
          DUMMY_L2_BRIDGE_ADDRESS,
          L1ERC20.address,
          DUMMY_UPGRADER_ADDRESS
        )
      ).to.be.revertedWith(ERROR_STRINGS.ALREADY_INITIALIZED)
    })
  })

  describe('ERC20 deposits', () => {
    // 1 thousand e18
    const depositAmount = INITIAL_TOTAL_L1_SUPPLY.div(BigNumber.from('1000000000000000000')).div(2)
    console.log(`deposit amount: ${depositAmount}`)

    beforeEach(async () => {
      await L1ERC20.connect(alice).approve(
        L1ECOBridge.address,
        depositAmount
      )
    })

    it.only('depositERC20() escrows the deposit amount and sends the correct deposit message', async () => {
      console.log(`alice balance: ${await L1ERC20.balanceOf(alice.address)}`)

      await L1ECOBridge.connect(alice).depositERC20(
        L1ERC20.address,
        DUMMY_L2_ERC20_ADDRESS,
        depositAmount,
        FINALIZATION_GAS,
        NON_NULL_BYTES32
      )

      console.log(await L1ECOBridge.inflationMultiplier())
      
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
            depositAmount,
            NON_NULL_BYTES32,
          ]
        ),
        FINALIZATION_GAS,
      ])

      expect(await L1ERC20.balanceOf(alice.address)).to.equal(
        INITIAL_TOTAL_L1_SUPPLY - depositAmount
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
            depositAmount,
            NON_NULL_BYTES32,
          ]
        ),
        FINALIZATION_GAS,
      ])

      expect(await L1ERC20.balanceOf(alice.address)).to.equal(
        INITIAL_TOTAL_L1_SUPPLY - depositAmount
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

    describe('Handling ERC20.transferFrom() failures that revert ', () => {
      let Fake__L1ERC20: FakeContract
      before(async () => {
        Fake__L1ERC20 = await smock.fake<Contract>('ERC20')
        Fake__L1ERC20.transferFrom.reverts()
      })

      it('depositERC20(): will revert if ERC20.transferFrom() reverts', async () => {
        await expect(
          L1ECOBridge.connect(alice).depositERC20(
            Fake__L1ERC20.address,
            DUMMY_L2_ERC20_ADDRESS,
            depositAmount,
            FINALIZATION_GAS,
            NON_NULL_BYTES32
          )
        ).to.be.revertedWith('SafeERC20: low-level call failed')
      })

      it('depositERC20To(): will revert if ERC20.transferFrom() reverts', async () => {
        await expect(
          L1ECOBridge.connect(alice).depositERC20To(
            Fake__L1ERC20.address,
            DUMMY_L2_ERC20_ADDRESS,
            bob.address,
            depositAmount,
            FINALIZATION_GAS,
            NON_NULL_BYTES32
          )
        ).to.be.revertedWith('SafeERC20: low-level call failed')
      })

      it('depositERC20To(): will revert if the L1 ERC20 has no code or is zero address', async () => {
        await expect(
          L1ECOBridge.connect(alice).depositERC20To(
            ethers.constants.AddressZero,
            DUMMY_L2_ERC20_ADDRESS,
            bob.address,
            depositAmount,
            FINALIZATION_GAS,
            NON_NULL_BYTES32
          )
        ).to.be.revertedWith('Address: call to non-contract')
      })
    })

    describe('Handling ERC20.transferFrom failures that return false', () => {
      let Fake__L1ERC20: FakeContract
      before(async () => {
        Fake__L1ERC20 = await smock.fake('ERC20')
        Fake__L1ERC20.transferFrom.returns(false)
      })

      it('deposit(): will revert if ERC20.transferFrom() returns false', async () => {
        await expect(
          L1ECOBridge.connect(alice).depositERC20(
            Fake__L1ERC20.address,
            DUMMY_L2_ERC20_ADDRESS,
            depositAmount,
            FINALIZATION_GAS,
            NON_NULL_BYTES32
          )
        ).to.be.revertedWith('SafeERC20: ERC20 operation did not succeed')
      })

      it('depositTo(): will revert if ERC20.transferFrom() returns false', async () => {
        await expect(
          L1ECOBridge.depositERC20To(
            Fake__L1ERC20.address,
            DUMMY_L2_ERC20_ADDRESS,
            bob.address,
            depositAmount,
            FINALIZATION_GAS,
            NON_NULL_BYTES32
          )
        ).to.be.revertedWith('SafeERC20: ERC20 operation did not succeed')
      })
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
      ).to.be.revertedWith(ERROR_STRINGS.INVALID_MESSENGER)
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
      ).to.be.revertedWith(ERROR_STRINGS.INVALID_X_DOMAIN_MSG_SENDER)
    })

    it('should credit funds to the withdrawer and not use too much gas', async () => {
      // First Alice will 'donate' some tokens so that there's a balance to be withdrawn
      const withdrawalAmount = 10
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
        withdrawalAmount,
        NON_NULL_BYTES32,
        { from: Fake__L1CrossDomainMessenger.address }
      )

      expect(await L1ERC20.balanceOf(NON_ZERO_ADDRESS)).to.be.equal(
        withdrawalAmount
      )
    })
  })

  describe('upgrades to L2 contract', async () => {
    it('should only work if caller is upgrader', async () => {

      // Fake__L1CrossDomainMessenger.xDomainMessageSender.returns(
      //   DUMMY_L2_BRIDGE_ADDRESS
      // )

      await expect(
        proxy.connect(alice).upgradeL2(DUMMY_L2_ERC20_ADDRESS, FINALIZATION_GAS)
      ).to.not.be.revertedWith(ERROR_STRINGS.NOT_UPGRADER)

      expect(
        Fake__L1CrossDomainMessenger.sendMessage.getCall(0).args
      ).to.deep.equal([
        DUMMY_L2_BRIDGE_ADDRESS,
        (await getContractInterface('L2ECOBridge')).encodeFunctionData(
          'upgradeImpl',
          [
            DUMMY_L2_ERC20_ADDRESS,
          ]
        ),
        FINALIZATION_GAS,
      ])
    })
  })
})