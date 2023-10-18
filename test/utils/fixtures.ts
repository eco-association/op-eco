import hre from 'hardhat'
import {
  L2ECO,
  L2ECOx,
  L1ECOBridge,
  L2ECOBridge,
  ProxyAdmin,
} from '../../typechain-types'
import { Address } from '@eth-optimism/core-utils'
import { CrossChainMessenger } from '@eth-optimism/sdk'
const { ethers, upgrades } = hre

export async function deployL1Test(
  l1CrossDomainMessenger: Address,
  l2Bridge: Address,
  l1Token: Address,
  l2Token: Address,
  upgrader: Address
): Promise<[L1ECOBridge, ProxyAdmin]> {
  // const proxyAdmin = (await upgrades.admin.getInstance()) as ProxyAdmin
  const l1BridgeProxyAddress = await deployProxy()
  const proxyAdmin = await getProxyAdmin()

  const l1BridgeProxy = await upgradeBridgeL1(
    l1BridgeProxyAddress,
    l1CrossDomainMessenger,
    l2Bridge,
    l1Token,
    l2Token,
    proxyAdmin.address,
    upgrader
  )

  return [l1BridgeProxy as L1ECOBridge, proxyAdmin]
}

export async function deployL2Test(
  l2CrossDomainMessenger: Address,
  l1Bridge: Address,
  l1Token: Address
  // opts: { adminBridge: boolean } = { adminBridge: true }
): Promise<[L2ECO, L2ECOBridge, ProxyAdmin]> {
  const l2BridgeProxyAddress = await deployProxy()
  const l2EcoProxyAddress = await deployTokenProxy()
  const proxyAdmin = await getProxyAdmin()

  const l2EcoProxy = await upgradeEcoL2(
    l2EcoProxyAddress,
    l1Token,
    l2BridgeProxyAddress
  )

  const l2BridgeProxy = await upgradeBridgeL2(
    l2BridgeProxyAddress,
    l2CrossDomainMessenger,
    l1Bridge,
    l1Token,
    l2EcoProxyAddress,
    proxyAdmin.address
  )

  return [l2EcoProxy as L2ECO, l2BridgeProxy as L2ECOBridge, proxyAdmin]
}

export async function upgradeBridgeL1(
  l1BridgeProxyAddress: Address,
  l1messenger: Address,
  l2BridgeAddress: Address,
  l1ECO: Address,
  l2ECO: Address,
  l1ProxyAdmin: Address,
  upgrader: Address
) {
  const L1ECOBridgeContract = await ethers.getContractFactory('L1ECOBridge')

  const l1BridgeProxy = await upgrades.upgradeProxy(
    l1BridgeProxyAddress,
    L1ECOBridgeContract,
    {
      call: {
        fn: 'initialize',
        args: [
          l1messenger,
          l2BridgeAddress,
          l1ECO,
          l2ECO,
          l1ProxyAdmin,
          upgrader,
        ],
      },
    }
  )

  return l1BridgeProxy as L1ECOBridge
}

export async function upgradeBridgeL2(
  l2BridgeProxyAddress: Address,
  l2messenger: Address,
  l1BridgeAddress: Address,
  l1Eco: Address,
  l2Eco: Address,
  l2ProxyAdmin: Address
): Promise<L2ECOBridge> {
  const L2ECOBridgeContract = await ethers.getContractFactory('L2ECOBridge')

  const l2BridgeProxy = await upgrades.upgradeProxy(
    l2BridgeProxyAddress,
    L2ECOBridgeContract,
    {
      call: {
        fn: 'initialize',
        args: [l2messenger, l1BridgeAddress, l1Eco, l2Eco, l2ProxyAdmin],
      },
    }
  )

  return l2BridgeProxy as L2ECOBridge
}

export async function upgradeEcoL2(
  l2EcoProxyAddress: Address,
  l1EcoToken: Address,
  l2BridgeAddress: Address
): Promise<L2ECO> {
  const L2ECOContract = await ethers.getContractFactory('L2ECO')

  const l2EcoProxy = await upgrades.upgradeProxy(
    l2EcoProxyAddress,
    L2ECOContract,
    {
      call: {
        fn: 'initialize',
        args: [l1EcoToken, l2BridgeAddress],
      },
    }
  )

  return l2EcoProxy as L2ECO
}

export async function deployEcoXL2(
  l1EcoXToken: Address,
  l2OPBridgeAddress: Address,
  l2ECOBridgeAddress: Address
): Promise<L2ECOx> {
  const L2ECOxContract = await ethers.getContractFactory('L2ECOx')

  const l2EcoXProxy = await upgrades.deployProxy(
    L2ECOxContract,
    [l1EcoXToken, l2OPBridgeAddress, l2ECOBridgeAddress],
    {
      initializer: 'initialize',
    }
  )

  return l2EcoXProxy as L2ECOx
}

export async function deployProxy(): Promise<Address> {
  const InitialImplementationContract = await ethers.getContractFactory(
    'InitialImplementation'
  )
  const proxyInitial = await upgrades.deployProxy(
    InitialImplementationContract,
    [],
    {
      initializer: 'initialize',
    }
  )
  // const proxyInitial = await upgrades.deployProxy(InitialImplementationContract, [])

  await proxyInitial.deployed()

  return proxyInitial.address
}

export async function deployTokenProxy(): Promise<Address> {
  const TokenInitialContract = await ethers.getContractFactory('TokenInitial')
  const proxyInitial = await upgrades.deployProxy(TokenInitialContract, [], {
    initializer: 'initialize',
  })

  await proxyInitial.deployed()

  return proxyInitial.address
}

export async function getProxyAdmin(
  verbose: boolean = false
): Promise<ProxyAdmin> {
  const proxyAdmin = (await upgrades.admin.getInstance()) as ProxyAdmin
  if (verbose) {
    console.log(`address : ${proxyAdmin.address}`)
    console.log(`owner : ${await proxyAdmin.owner()}`)
  }

  await proxyAdmin.deployed()

  return proxyAdmin
}

export async function transferOwnership(
  network: string,
  proxy: Address
): Promise<void> {
  hre.changeNetwork(network)

  const proxyAdmin = await getProxyAdmin()

  const currentOwner = await proxyAdmin.owner()
  const [me] = await hre.ethers.getSigners()
  if ((await me.getAddress()) !== currentOwner) {
    throw new Error('you need to own the proxy admin to run this script')
  }

  await proxyAdmin.transferOwnership(proxy)
  console.log(`admin owner changed to ${proxy}`)
}

export async function transferOwnershipTest(
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

export async function setupOP(
  l1Network,
  l2Network
): Promise<CrossChainMessenger> {
  hre.changeNetwork(l2Network)
  const l2ChainId = hre.network.config.chainId
  const [l2Wallet] = await hre.ethers.getSigners()
  hre.changeNetwork(l1Network)
  const l1ChainId = hre.network.config.chainId
  const [l1Wallet] = await hre.ethers.getSigners()

  if (l2ChainId && l1ChainId) {
    return new CrossChainMessenger({
      l1ChainId,
      l2ChainId,
      l1SignerOrProvider: l1Wallet,
      l2SignerOrProvider: l2Wallet,
      bedrock: true,
    })
  } else {
    throw new Error('need chain IDs to use CrossChainMessenger')
  }
}
