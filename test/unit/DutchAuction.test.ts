import { expect, assert } from "chai";
import { ethers, network } from "hardhat";
import {
  DutchAuction,
  DutchAuction__factory,
  NftItem,
  NftItem__factory,
} from "../../typechain-types";

// Function
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";

// Data
import {
  DISCOUNT_RATE,
  NFT_ITEM_NAME,
  NFT_ITEM_SYMBOL,
  STARTING_PRICE,
  TOKEN_ID,
  developmentChains,
} from "../../helper-hardhat-config";

// Types
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumber } from "ethers";

// ------------

describe("DutchAuction", function () {
  const REQUIRED: BigNumber = ethers.utils.parseUnits("2");
  beforeEach(async () => {
    if (!developmentChains.includes(network.name)) {
      throw new Error("You need to be on a development chain to run unit tests");
    }
  });

  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshot in every test.
  type DeployFixture = {
    deployer: SignerWithAddress;
    dutchAuction: DutchAuction;
    nftItem: NftItem;
  };
  async function deployDutchAuctionFixture(): Promise<DeployFixture> {
    const [deployer]: SignerWithAddress[] = await ethers.getSigners();

    const nftItemFactory: NftItem__factory = await ethers.getContractFactory("NftItem", deployer);
    const nftItem: NftItem = await nftItemFactory.deploy(NFT_ITEM_NAME, NFT_ITEM_SYMBOL);
    await nftItem.deployed();

    const dutchAuctionFactory: DutchAuction__factory = await ethers.getContractFactory(
      "DutchAuction",
      deployer
    );
    const dutchAuction: DutchAuction = await dutchAuctionFactory.deploy();
    await dutchAuction.deployed();

    // Approve item by our dutch auction
    await nftItem.setApprovalForAll(dutchAuction.address, true);
    return { deployer, dutchAuction, nftItem };
  }

  async function listItemInAuction(dutchAuction: DutchAuction, nftAddress: string) {
    await dutchAuction.createAuction(nftAddress, TOKEN_ID, STARTING_PRICE, DISCOUNT_RATE);
    return dutchAuction;
  }

  describe("#createAuction", function () {
    it("should set auction parameters correctly", async function () {
      const { deployer, dutchAuction, nftItem } = await loadFixture(deployDutchAuctionFixture);

      const tx = await dutchAuction.createAuction(
        nftItem.address,
        TOKEN_ID,
        STARTING_PRICE,
        DISCOUNT_RATE
      );

      const txReceipt = await tx.wait();

      // Getting the block timestamp to compare it with startAt parameter
      const blockTime = (await ethers.provider.getBlock(txReceipt.blockNumber)).timestamp;

      const duration: BigNumber = await dutchAuction.getDuration();

      const auction = await dutchAuction.auctions(nftItem.address, TOKEN_ID);

      // You should avoid testing it this was, there should be only on assert or expect in one `it`
      assert.equal(auction.seller, deployer.address);
      assert.equal(auction.nftAddress, nftItem.address);
      assert(auction.tokenId.eq(TOKEN_ID));
      assert(auction.startingAt.eq(BigNumber.from(blockTime)));
      assert(auction.endingAt.eq(BigNumber.from(blockTime).mul(duration)));
      assert(auction.startingPrice.eq(STARTING_PRICE));
      assert(auction.discountRate.eq(DISCOUNT_RATE));
      assert.equal(auction.status, 1 /* IN_PROGRESS */);
    });

    it("should emit `AuctionCreated` event if auction created successfully", async function () {
      const { deployer, dutchAuction, nftItem } = await loadFixture(deployDutchAuctionFixture);

      await expect(
        dutchAuction.createAuction(nftItem.address, TOKEN_ID, STARTING_PRICE, DISCOUNT_RATE)
      )
        .to.emit(dutchAuction, "AuctionCreated")
        .withArgs(nftItem.address, TOKEN_ID);
    });

    it("should allow even if the auction is `ENDED`", async function () {
      const { deployer, dutchAuction, nftItem } = await loadFixture(deployDutchAuctionFixture);

      // Creating Auction
      await dutchAuction.createAuction(nftItem.address, TOKEN_ID, STARTING_PRICE, DISCOUNT_RATE);

      // Deleteing auction
      await dutchAuction.cancelAuction(nftItem.address, TOKEN_ID);

      // Creating auction again
      await expect(
        dutchAuction.createAuction(nftItem.address, TOKEN_ID, STARTING_PRICE, DISCOUNT_RATE)
      )
        .to.emit(dutchAuction, "AuctionCreated")
        .withArgs(nftItem.address, TOKEN_ID);
    });

    it("reverts if NFT address is zero address", async function () {
      const { deployer, dutchAuction, nftItem } = await loadFixture(deployDutchAuctionFixture);

      await expect(
        dutchAuction.createAuction(
          ethers.constants.AddressZero,
          TOKEN_ID,
          STARTING_PRICE,
          DISCOUNT_RATE
        )
      ).to.be.revertedWithCustomError(dutchAuction, "DutchAuction__InvalidAddress");
    });

    it("reverts if the connector is not the owner of the NFT", async function () {
      const [, hacker]: SignerWithAddress[] = await ethers.getSigners();
      const { deployer, dutchAuction, nftItem } = await loadFixture(deployDutchAuctionFixture);

      await expect(
        dutchAuction
          .connect(hacker)
          .createAuction(nftItem.address, TOKEN_ID, STARTING_PRICE, DISCOUNT_RATE)
      )
        .to.be.revertedWithCustomError(dutchAuction, "DutchAuction__NotOwner")
        .withArgs(nftItem.address, TOKEN_ID, hacker.address);
    });

    it("reverts if the item is not approved by DutchAuction contract", async function () {
      const { deployer, dutchAuction, nftItem } = await loadFixture(deployDutchAuctionFixture);

      // remove approval from DutchAuction contract
      await nftItem.setApprovalForAll(dutchAuction.address, false);

      await expect(
        dutchAuction.createAuction(nftItem.address, TOKEN_ID, STARTING_PRICE, DISCOUNT_RATE)
      )
        .to.be.revertedWithCustomError(dutchAuction, "DutchAuction_NotApproved")
        .withArgs(nftItem.address, TOKEN_ID, deployer.address);
    });

    it("reverts if NFT address is zero address", async function () {
      const { deployer, dutchAuction, nftItem } = await loadFixture(deployDutchAuctionFixture);

      const overflowDiscountRate: BigNumber = DISCOUNT_RATE.mul(2);
      const duration: BigNumber = await dutchAuction.getDuration(); // 7 days
      await expect(
        dutchAuction.createAuction(
          nftItem.address,
          TOKEN_ID,
          STARTING_PRICE,
          overflowDiscountRate // this means is will lose 2 ETH every day means 14 ETH in 7 days so it will reverts
        )
      )
        .to.be.revertedWithCustomError(dutchAuction, "DutchAuction__FloorPriceLessThanZero")
        .withArgs(STARTING_PRICE, overflowDiscountRate, duration);
    });

    it("reverts if the auction is already created or ended", async function () {
      const { deployer, dutchAuction, nftItem } = await loadFixture(deployDutchAuctionFixture);

      // Create the auction
      await dutchAuction.createAuction(nftItem.address, TOKEN_ID, STARTING_PRICE, DISCOUNT_RATE);

      // Trying to create the auction again
      await expect(
        dutchAuction.createAuction(nftItem.address, TOKEN_ID, STARTING_PRICE, DISCOUNT_RATE)
      )
        .to.be.revertedWithCustomError(dutchAuction, "DutchAuction__AuctionCreated")
        .withArgs(nftItem.address, TOKEN_ID);
    });
  });

  describe("#buyItem", function () {
    it("should emit `AuctionEnded` event", async function () {
      const [, buyer]: SignerWithAddress[] = await ethers.getSigners();
      const {
        deployer,
        dutchAuction: _dutchAuction,
        nftItem,
      } = await loadFixture(deployDutchAuctionFixture);

      // List item into an auction
      const dutchAuction: DutchAuction = await listItemInAuction(_dutchAuction, nftItem.address);

      await expect(
        dutchAuction.connect(buyer).buyItem(nftItem.address, TOKEN_ID, {
          value: STARTING_PRICE,
        })
      )
        .to.emit(dutchAuction, "AuctionEnded")
        .withArgs(nftItem.address, TOKEN_ID, buyer.address);
    });

    it("should transfer the NFT item to the buyer", async function () {
      const [, buyer]: SignerWithAddress[] = await ethers.getSigners();
      const {
        deployer,
        dutchAuction: _dutchAuction,
        nftItem,
      } = await loadFixture(deployDutchAuctionFixture);

      // List item into an auction
      const dutchAuction: DutchAuction = await listItemInAuction(_dutchAuction, nftItem.address);

      await dutchAuction
        .connect(buyer)
        .buyItem(nftItem.address, TOKEN_ID, { value: STARTING_PRICE });

      const owner: string = await nftItem.ownerOf(0);

      assert.equal(owner, buyer.address);
    });

    it("should transfer the balance to the seller ", async function () {
      const [, buyer]: SignerWithAddress[] = await ethers.getSigners();
      const {
        deployer,
        dutchAuction: _dutchAuction,
        nftItem,
      } = await loadFixture(deployDutchAuctionFixture);

      // List item into an auction
      const dutchAuction: DutchAuction = await listItemInAuction(_dutchAuction, nftItem.address);

      const sellerBalanceBefore: BigNumber = await ethers.provider.getBalance(deployer.address);
      const price: BigNumber = await dutchAuction.getPrice(nftItem.address, TOKEN_ID);
      await dutchAuction
        .connect(buyer)
        .buyItem(nftItem.address, TOKEN_ID, { value: STARTING_PRICE });

      const sellerBalanceAfter: BigNumber = await ethers.provider.getBalance(deployer.address);

      // The sellerBalance will == (price + balance before) - total gas costs since deployer is the lister
      assert(sellerBalanceAfter.lte(price.add(sellerBalanceBefore)));
    });

    it("reverts if the auction is not `IN_PROGRESS`", async function () {
      const { deployer, dutchAuction, nftItem } = await loadFixture(deployDutchAuctionFixture);
      await expect(
        dutchAuction.connect(deployer).buyItem(nftItem.address, TOKEN_ID, {
          value: STARTING_PRICE,
        })
      )
        .to.be.revertedWithCustomError(dutchAuction, "DutchAuction__AuctionNotInProgress")
        .withArgs(nftItem.address, TOKEN_ID);
    });

    it("reverts if the offered price is less than item price", async function () {
      const {
        deployer,
        dutchAuction: _dutchAuction,
        nftItem,
      } = await loadFixture(deployDutchAuctionFixture);

      // List item into an auction
      const dutchAuction: DutchAuction = await listItemInAuction(_dutchAuction, nftItem.address);

      const inSufficientAmount: BigNumber = STARTING_PRICE.div(2);

      await expect(
        dutchAuction.buyItem(nftItem.address, TOKEN_ID, {
          value: inSufficientAmount,
        })
      )
        .to.revertedWithCustomError(dutchAuction, "DutchAuction__InsufficientAmount")
        .withArgs(nftItem.address, TOKEN_ID, inSufficientAmount);
    });
  });

  describe("#cancelAuction", function () {
    it("should emit `AuctionEnded` event with AddressZero as winner", async function () {
      const {
        deployer,
        dutchAuction: _dutchAuction,
        nftItem,
      } = await loadFixture(deployDutchAuctionFixture);

      const dutchAuction = await listItemInAuction(_dutchAuction, nftItem.address);

      await expect(dutchAuction.cancelAuction(nftItem.address, TOKEN_ID))
        .to.emit(dutchAuction, "AuctionEnded")
        .withArgs(nftItem.address, TOKEN_ID, ethers.constants.AddressZero);
    });

    it("should make the auction status `ENDED`", async function () {
      const {
        deployer,
        dutchAuction: _dutchAuction,
        nftItem,
      } = await loadFixture(deployDutchAuctionFixture);

      const dutchAuction = await listItemInAuction(_dutchAuction, nftItem.address);

      await dutchAuction.cancelAuction(nftItem.address, TOKEN_ID);

      const auctionStatus: number = (await dutchAuction.getAuction(nftItem.address, TOKEN_ID))
        .status;

      assert.equal(auctionStatus, 2 /* ENDED */);
    });

    it("should reverts if the connector is not the seller", async function () {
      const [, hacker]: SignerWithAddress[] = await ethers.getSigners();
      const {
        deployer,
        dutchAuction: _dutchAuction,
        nftItem,
      } = await loadFixture(deployDutchAuctionFixture);

      const dutchAuction = await listItemInAuction(_dutchAuction, nftItem.address);

      const seller: string = (await dutchAuction.getAuction(nftItem.address, TOKEN_ID)).seller;

      await expect(dutchAuction.connect(hacker).cancelAuction(nftItem.address, TOKEN_ID))
        .to.be.revertedWithCustomError(dutchAuction, "DutchAuction__NotAuctionSeller")
        .withArgs(seller);
    });

    it("should reverts if the auction is not existed", async function () {
      const [, buyer]: SignerWithAddress[] = await ethers.getSigners();
      const {
        deployer,
        dutchAuction: _dutchAuction,
        nftItem,
      } = await loadFixture(deployDutchAuctionFixture);

      const dutchAuction = await listItemInAuction(_dutchAuction, nftItem.address);

      await dutchAuction
        .connect(buyer)
        .buyItem(nftItem.address, TOKEN_ID, { value: STARTING_PRICE });

      await expect(dutchAuction.cancelAuction(nftItem.address, TOKEN_ID))
        .to.be.revertedWithCustomError(dutchAuction, "DutchAuction__AuctionNotInProgress")
        .withArgs(nftItem.address, TOKEN_ID);
    });
  });

  describe("#getPrice", function () {
    it("should return the price of the item ", async function () {
      const { deployer, dutchAuction, nftItem } = await loadFixture(deployDutchAuctionFixture);

      await dutchAuction.createAuction(nftItem.address, TOKEN_ID, STARTING_PRICE, DISCOUNT_RATE);

      await ethers.provider.send("evm_increaseTime", [
        24 * 60 * 60 + 1 /* increase one second to go down the 9 ETH */,
      ]);
      await ethers.provider.send("evm_mine", []);

      const price: BigNumber = await dutchAuction.getPrice(nftItem.address, TOKEN_ID);

      assert(price.lte(ethers.utils.parseUnits("9")));
    });

    it("should reverts if the auction is not existed", async function () {
      const { deployer, dutchAuction, nftItem } = await loadFixture(deployDutchAuctionFixture);

      await dutchAuction.createAuction(nftItem.address, TOKEN_ID, STARTING_PRICE, DISCOUNT_RATE);

      await dutchAuction.cancelAuction(nftItem.address, TOKEN_ID);

      await expect(dutchAuction.getPrice(nftItem.address, TOKEN_ID))
        .to.be.revertedWithCustomError(dutchAuction, "DutchAuction__AuctionNotInProgress")
        .withArgs(nftItem.address, TOKEN_ID);
    });
  });
});
