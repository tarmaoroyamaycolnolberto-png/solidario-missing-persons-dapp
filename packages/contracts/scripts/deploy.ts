import { network } from "hardhat";

const { viem, networkName } = await network.connect("bscMainnet");

console.log(`Deploying MissingPersons to ${networkName}...`);

const contract = await viem.deployContract("MissingPersons");

console.log("MissingPersons desplegado en:", contract.address);