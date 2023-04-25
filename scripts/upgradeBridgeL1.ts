import { upgradeBridges } from "../test/utils/fixtures"

async function main() {
    await upgradeBridges(process.env.L1_BRIDGE_ADDRESS || '', process.env.L2_BRIDGE_ADDRESS || '', 'L1')
}

main().catch((error) => {
    console.error(error)
    process.exitCode = 1
})
