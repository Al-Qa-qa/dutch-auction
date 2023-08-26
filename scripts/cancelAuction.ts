import { ethers, network } from "hardhat";
import jsonContracts from "../deployed-contracts.json";
import { DutchAuction, NftItem } from "../typechain-types";
import { DISCOUNT_RATE, STARTING_PRICE, TOKEN_ID } from "../helper-hardhat-config";

async function cancelAuction() {
  const [seller, buyer] = await ethers.getSigners();
  const networkName: string = network.name;
  const contracts = Object(jsonContracts);
  if (!contracts[networkName].DutchAuction) {
    throw new Error("Contract is not deployed yet");
  }
  if (networkName === "hardhat") {
    throw new Error("Can't run scripts to hardhat network deployed contract");
  }
  const dutchAuction: DutchAuction = await ethers.getContractAt(
    "DutchAuction",
    contracts[networkName].DutchAuction,
    seller
  );

  const nftItem: NftItem = await ethers.getContractAt(
    "NftItem",
    contracts[networkName].NftItem,
    seller
  );

  try {
    // Creating auction of the item
    await dutchAuction.connect(seller).cancelAuction(nftItem.address, TOKEN_ID);
  } catch (err) {
    console.log(err);
    throw new Error("Failed to Cancel item auction");
  }

  return dutchAuction;
}

cancelAuction()
  .then((dutchAuction) => {
    console.log("Item cancel from the auction successfully");
    process.exit(0);
  })
  .catch((err) => {
    console.log(err);
    process.exit(1);
  });
