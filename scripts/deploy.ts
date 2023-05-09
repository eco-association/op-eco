import hre from 'hardhat'
import {
  deployBridgeProxy,
  deployTokenProxy,
  getProxyAdmin,
  upgradeBridgeL1,
  upgradeBridgeL2,
  upgradeEcoL2,
} from '../test/utils/fixtures'

const UPGRADER_ADDRESS = '0x71D536c7d9E65AF36AFAA28016618a8C3Ea32952'
const L1_OP_MESSANGER_ADDRESS = '0x5086d1eEF304eb5284A0f6720f79403b4e9bE294'
const L2_OP_MESSANGER_ADDRESS = '0x4200000000000000000000000000000000000007'
const L1_ECO_ADDRESS = '0x3E87d4d9E69163E7590f9b39a70853cf25e5ABE3'
const L1_NETWORK = 'goerli'
const L2_NETWORK = 'goerliOptimism'

// const l1BridgeProxyAddress = '0x7a01E277B8fDb8CDB2A2258508514716359f44A0'
// const l2BridgeProxyAddress = '0x7a01E277B8fDb8CDB2A2258508514716359f44A0'
// const l2EcoProxyAddress = '0x54bBECeA38ff36D32323f8A754683C1F5433A89f'

async function main() {
  hre.changeNetwork(L1_NETWORK)

  const l1BridgeProxyAddress = await deployBridgeProxy()
  console.log(`L1 Bridge deployed to: ${l1BridgeProxyAddress}`)

  const l1ProxyAdmin = await getProxyAdmin(true)
  console.log(`Proxy Admin L1 deployed to: ${l1ProxyAdmin.address}`)

  hre.changeNetwork(L2_NETWORK)

  const l2BridgeProxyAddress = await deployBridgeProxy()
  console.log(`L2 Bridge deployed to: ${l2BridgeProxyAddress}`)

  const l2EcoProxyAddress = await deployTokenProxy()
  console.log(`L2ECO deployed to: ${l2EcoProxyAddress}`)

  const l2ProxyAdmin = await getProxyAdmin(true)
  console.log(`Proxy Admin L2 deployed to: ${l2ProxyAdmin.address}`)

  await upgradeEcoL2(l2EcoProxyAddress, L1_ECO_ADDRESS, l2BridgeProxyAddress)
  console.log(`L2 ECO initialized`)

  await upgradeBridgeL2(
    l2BridgeProxyAddress,
    L2_OP_MESSANGER_ADDRESS,
    l1BridgeProxyAddress,
    l2EcoProxyAddress,
    l2ProxyAdmin.address
  )
  console.log(`L2 Bridge initialized`)

  hre.changeNetwork(L1_NETWORK)

  await upgradeBridgeL1(
    l1BridgeProxyAddress,
    L1_OP_MESSANGER_ADDRESS,
    l2BridgeProxyAddress,
    L1_ECO_ADDRESS,
    l1ProxyAdmin.address,
    UPGRADER_ADDRESS
  )
  console.log(`L1 Bridge initialized`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
