import { ethers, upgrades } from 'hardhat'
import {
  L2ECO,
  L1ECOBridge,
  L2ECOBridge,
  ProxyAdmin,
} from '../../typechain-types'
import { Address } from '@eth-optimism/core-utils'

// L2Eco contract initilization parameter types
type L2EcoContract = [l1Token: string, l2Bridge: string, initialPauser: string]

export async function deployL1(
  l1CrossDomainMessenger: Address,
  l2Bridge: Address,
  l1Token: Address,
  upgrader: Address,
  opts: { adminBridge: boolean } = { adminBridge: true }
): Promise<[L1ECOBridge, ProxyAdmin]> {
  const InitialBridgeContract = await ethers.getContractFactory('InitialBridge')
  const proxyInitial = await upgrades.deployProxy(InitialBridgeContract, [], {
    initializer: 'initialize',
  })

  await proxyInitial.deployed()

  const proxyAdmin = (await upgrades.admin.getInstance()) as ProxyAdmin

  const L1ECOBridgeContract = await ethers.getContractFactory('L1ECOBridge')
  const l1BridgeProxy = await upgrades.deployProxy(
    L1ECOBridgeContract,
    [l1CrossDomainMessenger, l2Bridge, l1Token, proxyAdmin.address, upgrader],
    {
      initializer: 'initialize',
    }
  )
  // address _l1messenger,
  // address _l2TokenBridge,
  // address _ecoAddress,
  // address _l1ProxyAdmin,
  // address _upgrader
  await l1BridgeProxy.deployed()

  // const proxyAdmin = (await upgrades.admin.getInstance()) as ProxyAdmin

  return [l1BridgeProxy as L1ECOBridge, proxyAdmin]
}
/**
 * Deploys the L2 contracts for testing. It first deploys the upgrades proxy, proxy admin, and the implementation contract for the L2ECO contract.
 * Then it deploys the L2ECOBridge contract with the L2ECO proxy address. Finally it deploys the real L2ECO contract through a implimentatioin
 * update of the proxy, with the L2ECOBridge address.
 * // NOTE: ProxyAdmin address never changes for a given deployer id, breaks tests
 * @returns Returns the L2ECO and L2ECOBridge contracts.
 */
export async function deployL2(
  l2CrossDomainMessenger: Address,
  l1Bridge: Address,
  l2Token: Address,
  initialPauser: Address,
  opts: { adminBridge: boolean } = { adminBridge: true }
): Promise<[L2ECO, L2ECOBridge, ProxyAdmin]> {
  const TokenInitialContract = await ethers.getContractFactory('TokenInitial')
  const proxyInitial = await upgrades.deployProxy(TokenInitialContract, [], {
    initializer: 'initialize',
  })

  await proxyInitial.deployed()

  const proxyAdmin = (await upgrades.admin.getInstance()) as ProxyAdmin

  const L2ECOBridgeContract = await ethers.getContractFactory('L2ECOBridge')
  const l2BridgeProxy = await upgrades.deployProxy(
    L2ECOBridgeContract,
    [
      l2CrossDomainMessenger,
      l1Bridge,
      proxyInitial.address,
      proxyAdmin.address,
    ],
    {
      initializer: 'initialize',
    }
  )
  await l2BridgeProxy.deployed()

  const L2EcoContract = await ethers.getContractFactory('L2ECO')
  const l2EcoProxy = await upgrades.upgradeProxy(
    proxyInitial.address,
    L2EcoContract,
    {
      call: {
        fn: 'initialize',
        args: [l2Token, l2BridgeProxy.address, initialPauser] as L2EcoContract,
      },
    }
  )

  if (opts.adminBridge) {
    transferOwnership(l2BridgeProxy.address)
    // console.log("ProxyAdmin Owner: ", await proxyAdmin.owner())
  }

  return [l2EcoProxy as L2ECO, l2BridgeProxy as L2ECOBridge, proxyAdmin]
}

export async function transferOwnership(
  newOwnerAddress: Address
): Promise<void> {
  const [owner] = await ethers.getSigners()
  const proxyAdmin = (await upgrades.admin.getInstance()) as ProxyAdmin
  await proxyAdmin.connect(owner).transferOwnership(newOwnerAddress)
}

export async function deployByName(name: string, ...args: any[]): Promise<any> {
  const Contract = await ethers.getContractFactory(name)
  const contract = await Contract.deploy(...args)
  await contract.deployed()
  return contract
}
