import { event, price } from "./types/sui/0x8d97f1cd6ac663735be08d1d2b6d02a159e711586461306ce60a2b7a6a565a9e.js";
import { event as oldEvent, price as oldPrice } from "./types/sui/0x00b53b0f4174108627fbee72e2498b58d6a2714cded53fac537034c220d26302.js";
import { PRICE_MAP } from './pyth.js'
import { Counter, Gauge, MetricOptions, LogLevel } from "@sentio/sdk";
import { BigDecimal, AggregationType } from "@sentio/sdk";
import LRU from 'lru-cache'

// List of sponsored feed identifiers with token pairs
const sponsoredFeeds = new Map([
  ["2a01deaec9e51a579277b34b122399984d0bbf57e2458a7e42fecd2829867a0d", "ADA/USD"],
  ["3fa4252848f9f0a1480be62745a4629d9eb1322aebab8a791e344b3b9c1adcf5", "ARB/USD"],
  ["93da3352f9f1d105fdfe4971cfa80e9dd777bfc5d0f683ebb6e1294b92137bb7", "AVAX/USD"],
  ["856aac602516addee497edf6f50d39e8c95ae5fb0da1ed434a8c2ab9c3e877e9", "BLUR/USD"],
  ["2f95862b045670cd22bee3114c39763a4a08beeb663b145d283c31d7d1101c4f", "BNB/USD"],
  ["e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43", "BTC/USD"],
  ["e5b274b2611143df055d6e7cd8d93fe1961716bcd4dca1cad87a83bc1e78c1ef", "CETUS/USD"],
  ["dcef50dd0a4cd2dcc17e45df1676dcb336a11a61c69df7a0299b0150c672d25c", "DOGE/USD"],
  ["ca3eed9b267293f6595901c734c7525ce8ef49adafe8284606ceb307afa2ca5b", "DOT/USD"],
  ["ff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace", "ETH/USD"],
  ["6e3f3fa8253588df9326580180233eb791e03b443a3ba7a1d892e73874e19a54", "LTC/USD"],
  ["5de33a9112c2b700b8d30b8a3402c103578ccfa2765696471cc672bd5cf6ac52", "MATIC/USD"],
  ["385f64d993f7b77d8182ed5003d97c60aa3361f3cecfe711544d2d59165e9bdf", "OP/USD"],
  ["d69731a2e74ac1ce884fc3890f7ee324b6deb66147055249568869ed700882e4", "PEPE/USD"],
  ["ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d", "SOL/USD"],
  ["23d7315113f5b1d3ba7a83604c44b94d79f4fd69af77f804fc7f920a6dc65744", "SUI/USD"],
  ["eaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a", "USDC/USD"],
  ["2b89b9dc8fdf9f34709a5b106b472f0f39bb6ca9ce04b0fd7f2e971688e2e53b", "USDT/USD"],
  ["d6835ad1f773de4a378115eb6824bd0c0e42d84d1c84d9750e853fb6b6c7794a", "WLD/USD"],
  ["09f7c1d7dfbb7df2b8fe3d3d87ee94a2259d212da4f30c1f0540d066dfa44723", "TIA/USD"],
  ["03ae4db29ed4ae33d323568895aa00337e658e348b37509f5372ae51f0af00d5", "APT/USD"],
  ["53614f1cb0c031d4af66c04cb9c756234adad0e1cee85303795091499a4084eb", "SEI/USD"],
  ["88250f854c019ef4f88a5c073d52a18bb1c6ac437033f5932cd017d24917ab46", "NAVX/USD"],
  ["7e17f0ac105abe9214deb9944c30264f5986bf292869c6bd8e8da3ccd92d79bc", "SCA/USD"],
  ["17cd845b16e874485b2684f8b8d1517d744105dbb904eec30222717f4bc9ee0d", "AFSUI/USD"],
  ["6120ffcf96395c70aa77e72dcb900bf9d40dccab228efca59a17b90ce423d5e8", "HASUI/USD"],
  ["57ff7100a282e4af0c91154679c5dae2e5dcacb93fd467ea9cb7e58afdcfde27", "VSUI/USD"]
]);

// Metric options configuration
const commonOptions: MetricOptions = {
  sparse: true,
  aggregationConfig: {
    intervalInMinutes: [1], // Use a single value instead of an array
    types: [AggregationType.LAST] // Use a single value instead of an array
  }
}

// Register gauges and counters for various metrics
const priceGauage = Gauge.register("price", commonOptions)
const priceEMAGauage = Gauge.register("price_ema", commonOptions)
const updates = Counter.register("update")
const updateWithFunder = Counter.register("update_price_feeds_with_funder")
const message = Counter.register("message")
const messages2 = Counter.register("mint_with_pyth_and_price")
const evmPriceGauage = Gauge.register("evm_price_unsafe", commonOptions)
const price_update_occur = Gauge.register("price_update_occur", commonOptions)
const price_update_counter = Counter.register("price_update_counter", {
  resolutionConfig: {
    intervalInMinutes: 5, // Use a single value instead of an array
  }
})

// New counters for specific metrics
const totalPriceUpdates = Counter.register("total_price_updates")
const dailyPriceUpdates = Counter.register("daily_price_updates", {
  resolutionConfig: {
    intervalInMinutes: 1440, // Use a single value instead of an array
  }
})
const totalSponsoredUpdates = Counter.register("total_sponsored_updates")
const dailySponsoredUpdates = Counter.register("daily_sponsored_updates", {
  resolutionConfig: {
    intervalInMinutes: 1440, // Use a single value instead of an array
  }
})
const totalNonSponsoredUpdates = Counter.register("total_non_sponsored_updates")
const dailyNonSponsoredUpdates = Counter.register("daily_non_sponsored_updates", {
  resolutionConfig: {
    intervalInMinutes: 1440, // Use a single value instead of an array
  }
})

// Set to track unique contract addresses and user addresses
const contractAddresses = new Set()
const userAddresses = new Set()

// Initialize an LRU cache to store up to 5000 items
const cache = new LRU<bigint, any>({
  maxSize: 5000,
  sizeCalculation: (value, key) => {
    return 1
  },
})

// Function to handle price feed updates
function handlePriceFeedUpdate(evt: any, ctx: any, isOldContract = false) {
  const priceId = decodeBytesArray(evt.data_decoded.price_feed.price_identifier.bytes)
  console.log(`Price ID: ${priceId}`)
  const symbol = PRICE_MAP.get(priceId) || "not listed"
  console.log(`Symbol: ${symbol}`)
  const isSponsored = sponsoredFeeds.has(priceId) ? "true" : "false"
  console.log(`Is Sponsored: ${isSponsored}`)
  const tokenPair = sponsoredFeeds.get(priceId) || symbol;
  const labels = { priceId, tokenPair, isSponsored }

  // Check if the price feed is native
  const isNative = (priceId == "0x23d7315113f5b1d3ba7a83604c44b94d79f4fd69af77f804fc7f920a6dc65744") ? "true" : "false"
  console.log(`Is Native: ${isNative}`)
  
  // Record the price and EMA price
  const priceValue = getPrice(evt.data_decoded.price_feed.price)
  const emaPriceValue = getPrice(evt.data_decoded.price_feed.ema_price)
  console.log(`Price: ${priceValue}, EMA Price: ${emaPriceValue}`)
  priceGauage.record(ctx, priceValue, labels)
  evmPriceGauage.record(ctx, priceValue, labels)
  priceEMAGauage.record(ctx, emaPriceValue, labels)
  
  // Record the occurrence of a price update and increment the counter
  price_update_occur.record(ctx, ctx.timestamp.getTime(), labels)
  price_update_counter.add(ctx, 1, labels)

  // Increment total and daily counters
  totalPriceUpdates.add(ctx, 1)
  dailyPriceUpdates.add(ctx, 1, labels)

  // Increment sponsored or non-sponsored counters
  if (isSponsored === "true") {
    totalSponsoredUpdates.add(ctx, 1)
    dailySponsoredUpdates.add(ctx, 1, labels)
  } else {
    totalNonSponsoredUpdates.add(ctx, 1)
    dailyNonSponsoredUpdates.add(ctx, 1, labels)
  }

  // Add contract address to the set
  contractAddresses.add(ctx.contractAddress)
  console.log(`Contract Addresses: ${Array.from(contractAddresses)}`)
  
  // Add user address to the set
  userAddresses.add(ctx.sender)
  console.log(`User Addresses: ${Array.from(userAddresses)}`)

  // Emit logs for the processor
  ctx.eventLogger.emit("PythPriceUpdate", {
    distinctId: ctx.sender, 
    severity: LogLevel.INFO, 
    message: `Pyth Price Update for ${tokenPair} at ${ctx.blockNumber}`,
    priceId: priceId,
    tokenPair: tokenPair,
    isNative: isNative,
    isSponsored: isSponsored,
    contractAddress: ctx.contractAddress,
    sender: ctx.sender,
    amount: evt.data_decoded.price_feed.price // Example value, adjust as needed
  });

  // Emit log for total price updates
  ctx.eventLogger.emit("TotalPriceUpdates", {
    distinctId: ctx.sender, 
    severity: LogLevel.INFO, 
    message: `Total Pyth Price Updates incremented at ${ctx.blockNumber}`,
    totalPriceUpdates: totalPriceUpdates
  });

  // Emit log for daily price updates
  ctx.eventLogger.emit("DailyPriceUpdates", {
    distinctId: ctx.sender, 
    severity: LogLevel.INFO, 
    message: `Daily Pyth Price Updates incremented for ${tokenPair} at ${ctx.blockNumber}`,
    dailyPriceUpdates: dailyPriceUpdates,
    priceId: priceId,
    tokenPair: tokenPair
  });

  // Emit log for total and daily sponsored updates
  if (isSponsored === "true") {
    ctx.eventLogger.emit("SponsoredPriceUpdates", {
      distinctId: ctx.sender, 
      severity: LogLevel.INFO, 
      message: `Sponsored Price Updates incremented for ${tokenPair} at ${ctx.blockNumber}`,
      totalSponsoredUpdates: totalSponsoredUpdates,
      dailySponsoredUpdates: dailySponsoredUpdates,
      priceId: priceId,
      tokenPair: tokenPair
    });
  } else {
    // Emit log for total and daily non-sponsored updates
    ctx.eventLogger.emit("NonSponsoredPriceUpdates", {
      distinctId: ctx.sender, 
      severity: LogLevel.INFO, 
      message: `Non-Sponsored Price Updates incremented for ${tokenPair} at ${ctx.blockNumber}`,
      totalNonSponsoredUpdates: totalNonSponsoredUpdates,
      dailyNonSponsoredUpdates: dailyNonSponsoredUpdates,
      priceId: priceId,
      tokenPair: tokenPair
    });
  }

  // Emit log for contract address usage
  ctx.eventLogger.emit("ContractAddressUsage", {
    distinctId: ctx.sender, 
    severity: LogLevel.INFO, 
    message: `Contract ${ctx.contractAddress} used Pyth at ${ctx.blockNumber}`,
    contractAddress: ctx.contractAddress
  });

  // Emit log for user address usage
  ctx.eventLogger.emit("UserAddressUsage", {
    distinctId: ctx.sender, 
    severity: LogLevel.INFO, 
    message: `User ${ctx.sender} used Pyth at ${ctx.blockNumber}`,
    sender: ctx.sender
  });

  // Placeholder for fees and transaction costs
  // Ensure feeAmount and txCost are available in the event data before uncommenting
  const feeAmount = evt.data_decoded.feeAmount; // Replace with actual fee amount if available
  const txCost = evt.data_decoded.txCost; // Replace with actual transaction cost if available

  // Example emit for total fees
  ctx.eventLogger.emit("TotalFees", {
    distinctId: ctx.sender,
    severity: LogLevel.INFO,
    message: `Total Fees incremented by ${feeAmount} at ${ctx.blockNumber}`,
    totalFees: totalFees,
    feeAmount: feeAmount
  });

  // Example emit for daily fees
  ctx.eventLogger.emit("DailyFees", {
    distinctId: ctx.sender,
    severity: LogLevel.INFO,
    message: `Daily Fees incremented by ${feeAmount} for ${tokenPair} at ${ctx.blockNumber}`,
    dailyFees: dailyFees,
    priceId: priceId,
    tokenPair: tokenPair,
    feeAmount: feeAmount
  });

  // Example emit for total transaction costs
  ctx.eventLogger.emit("TotalTxCosts", {
    distinctId: ctx.sender,
    severity: LogLevel.INFO,
    message: `Total Transaction Costs incremented by ${txCost} at ${ctx.blockNumber}`,
    totalTxCosts: totalTxCosts,
    txCost: txCost
  });

  // Example emit for daily transaction costs
  ctx.eventLogger.emit("DailyTxCosts", {
    distinctId: ctx.sender,
    severity: LogLevel.INFO,
    message: `Daily Transaction Costs incremented by ${txCost} for ${tokenPair} at ${ctx.blockNumber}`,
    dailyTxCosts: dailyTxCosts,
    priceId: priceId,
    tokenPair: tokenPair,
    txCost: txCost
  });
}

// Bind event handlers to the new contract's price feed update event
event.bind({}).onEventPriceFeedUpdateEvent((evt, ctx) => {
  handlePriceFeedUpdate(evt, ctx)
})

// Bind event handlers to the old contract's price feed update event
oldEvent.bind({}).onEventPriceFeedUpdateEvent((evt, ctx) => {
  handlePriceFeedUpdate(evt, ctx, true)
})

// Function to convert a price object into a BigDecimal value
export function getPrice(p: price.Price) {
  let expo = p.expo.magnitude.asBigDecimal()
  if (p.expo.negative) {
    expo = expo.negated()
  }
  let base = p.price.magnitude.asBigDecimal()
  if (p.price.negative) {
    base = base.negated()
  }
  return base.multipliedBy(BigDecimal(10).exponentiatedBy(expo))
}

// Function to decode a byte array into a hex string
function decodeBytesArray(bytes: number[]): string {
  return "0x" + Buffer.from(bytes).toString("hex")
}

// Function to get the list of unique contract addresses using Pyth
export function getContractAddresses() {
  return Array.from(contractAddresses)
}

// Function to get the list of unique user/wallet addresses using Pyth
export function getUserAddresses() {
  return Array.from(userAddresses)
}

// Function to get the list of contract addresses ranked by usage
export function getContractAddressesRanked() {
  const contractUsageMap = new Map()
  
  // Populate the map with usage counts
  contractAddresses.forEach(address => {
    contractUsageMap.set(address, (contractUsageMap.get(address) || 0) + 1)
  })

  // Convert the map to an array and sort by usage count
  return Array.from(contractUsageMap.entries()).sort((a, b) => b[1] - a[1])
}

// Placeholder for future implementation of total and daily fees
const totalFees = Counter.register("total_fees")
const dailyFees = Counter.register("daily_fees", {
  resolutionConfig: {
    intervalInMinutes: 1440, // Use a single value instead of an array
  }
})

// Placeholder for future implementation of total and daily transaction costs
const totalTxCosts = Counter.register("total_tx_costs")
const dailyTxCosts = Counter.register("daily_tx_costs", {
  resolutionConfig: {
    intervalInMinutes: 1440, // Use a single value instead of an array
  }
})
