import hre from 'hardhat'
import {
  deployProxy,
  getProxyAdmin,
  upgradeEcoXL2,
} from '../test/utils/fixtures'
import {
  L1_ECOX_ADDRESS,
  L2_NETWORK,
  L2_OP_STANDARD_BRIDGE,
  l2BridgeProxyAddress,
} from './constants'

async function main() {
  // hre.changeNetwork(L2_NETWORK)

  console.log(`on network ${hre.network.name}`)

  const l2ProxyAdmin = await getProxyAdmin(true)
  console.log(`Proxy Admin L2 deployed to: ${l2ProxyAdmin.address}`)

  const l2ECOxProxyAddress = await deployProxy()
  console.log(`L2 ECOx proxy deployed to: ${l2ECOxProxyAddress}`)

  await upgradeEcoXL2(l2ECOxProxyAddress, L1_ECOX_ADDRESS, L2_OP_STANDARD_BRIDGE, l2BridgeProxyAddress)
  console.log(`L2 ECOx initialized`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
