import { ethers } from 'hardhat'
import { deployL2 } from '../test/utils/fixtures'

const SHARK_TEST_ACCOUNT_ADDRESS = '0x6F81Ac980BC23fc70EcE1635D59ddBb3F12E6150'
const L2_OP_MESSANGER_ADDRESS = '0x4200000000000000000000000000000000000007'
const L1_BRIDGE_ADDRESS = '0x3d57102C3b62B470e0E1E3F575715ff4f82BC1FE'
const L1_ECO_ADDRESS = '0x3E87d4d9E69163E7590f9b39a70853cf25e5ABE3'

async function main() {
  const [l2Eco, l2Bridge, proxyAdminL2] = await deployL2(
    L2_OP_MESSANGER_ADDRESS,
    L1_BRIDGE_ADDRESS,
    L1_ECO_ADDRESS,
    SHARK_TEST_ACCOUNT_ADDRESS,
    { adminBridge: false }
  )
  console.log(`L2ECO deployed to: ${l2Eco.address}`)
  console.log(`L2 Bridge deployed to: ${l2Bridge.address}`)
  console.log(`Proxy Admin L2 deployed to: ${proxyAdminL2.address}`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
