import hre from 'hardhat'
import { getProxyAdmin } from '../test/utils/fixtures'
import { L1_NETWORK, l1BridgeProxyAddress } from './constants'

// this script is for transferring ownership of the proxy admin to the proxy

async function main() {
  hre.changeNetwork(L1_NETWORK)

  const proxyAdmin = await getProxyAdmin()

  const currentOwner = await proxyAdmin.owner()
  const [me] = await hre.ethers.getSigners()
  if ((await me.getAddress()) !== currentOwner) {
    throw('you need to own the proxy admin to run this script')
  }

  await proxyAdmin.transferOwnership(l1BridgeProxyAddress)
  console.log(`admin owner changed to ${l1BridgeProxyAddress}`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
