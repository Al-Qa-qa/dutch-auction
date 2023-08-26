import { ethers, network } from "hardhat";
import jsonContracts from "../deployed-contracts.json";
import { DutchAuction, NftItem } from "../typechain-types";
import { DISCOUNT_RATE, STARTING_PRICE, TOKEN_ID } from "../helper-hardhat-config";

async function createAuction() {
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
    // Approving item
    await nftItem.connect(seller).setApprovalForAll(dutchAuction.address, true);
  } catch (err) {
    console.log("Failed to approve the market");
    console.log(err);
  }

  try {
    // Creating auction of the item
    await dutchAuction
      .connect(seller)
      .createAuction(nftItem.address, TOKEN_ID, STARTING_PRICE, DISCOUNT_RATE);
  } catch (err) {
    console.log(err);
    throw new Error("Failed to list item in the Auction");
  }

  return dutchAuction;
}

createAuction()
  .then((dutchAuction) => {
    console.log("Item listed on the auction successfully");
    process.exit(0);
  })
  .catch((err) => {
    console.log(err);
    process.exit(1);
  });
