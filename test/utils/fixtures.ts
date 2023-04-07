import { ethers, upgrades } from "hardhat"
import { L2ECO, L2ECOBridge } from "../../dist/types"
import { AddressZero } from "@ethersproject/constants"
import { Address } from "@eth-optimism/core-utils"
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers"

/**
 * Deploys the L2 contracts for testing. It first deploys the upgrades proxy, proxy admin, and the implementation contract for the L2ECO contract.
 * Then it deploys the L2ECOBridge contract with the L2ECO proxy address. Finally it deploys the real L2ECO contract through a implimentatioin 
 * update of the proxy, with the L2ECOBridge address.
 * 
 * @returns Returns the L2ECO and L2ECOBridge contracts.
 */
export async function deployL2(l1Bridge: SignerWithAddress, l2CrossDomainMessenger: SignerWithAddress, initialPauser: SignerWithAddress): Promise<[L2ECO, L2ECOBridge]> {

    const L2EcoContract = await ethers.getContractFactory("L2Eco")
    const l2EcoProxyInitial = await upgrades.deployProxy(L2EcoContract, [AddressZero, AddressZero], {
        initializer: "initialize",
    })
    await l2EcoProxyInitial.deployed()

    const L2ECOBridgeContract = await ethers.getContractFactory("L2ECOBridge")
    const l2Bridge = await L2ECOBridgeContract.deploy(l2CrossDomainMessenger.address, l1Bridge.address, l2EcoProxyInitial.address)
    await l2Bridge.deployed()


    const l2EcoProxyFinal = await upgrades.upgradeProxy(l2EcoProxyInitial.address, L2EcoContract, {
        call: { fn: "initialize", args: [l2Bridge.address, initialPauser.address] },
    })

    // @ts-ignore
    return [l2EcoProxyFinal, l2Bridge]
}