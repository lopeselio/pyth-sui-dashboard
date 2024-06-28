import { event, price } from "./types/sui/0x8d97f1cd6ac663735be08d1d2b6d02a159e711586461306ce60a2b7a6a565a9e.js";
import { event as oldEvent, price as oldPrice } from "./types/sui/0x00b53b0f4174108627fbee72e2498b58d6a2714cded53fac537034c220d26302.js";
import { PRICE_MAP } from './pyth.js'
import { Counter, Gauge, MetricOptions } from "@sentio/sdk";
import { BigDecimal, AggregationType } from "@sentio/sdk";
import LRU from 'lru-cache'

// TO-DO
// Total Number of Pyth Price Updates

// Daily Number of Pyth Price Updates (by feed/asset type)

// Daily & Total Number of Sponsored Price Updates

// Daily & Total Number of Non-Sponsored Price Updates

// List of Contract Addresses Using Pyth

// List of Contract Addresses Using Pyth ranked by usage (number of price reads and updates)

// Total Number of Unique User/Wallet Addresses Using Apps Powered By Pyth (daily and cumulative)

// Total & Daily Fees paid by Price Update Requestor to the Pyth oracle

// Total & Daily transactions costs incurred by Price Update Requestors

interface PriceFeedUpdateEvent {
  data_decoded: {
    price_feed: {
      price_identifier: {
        bytes: string;
      };
    };
  };
}

// Define common options for metrics
const commonOptions: MetricOptions = {
  sparse: true,
  aggregationConfig: {
    intervalInMinutes: [1],
    types: [AggregationType.LAST]
  }
}

// Register gauges for tracking price and EMA (Exponential Moving Average) price
const priceGauage = Gauge.register("price", commonOptions)
const priceEMAGauage = Gauge.register("price_ema", commonOptions)

// Register counters for various events
const updates = Counter.register("update")
const updateWithFunder = Counter.register("update_price_feeds_with_funder")
const message = Counter.register("message")
const messages2 = Counter.register("mint_with_pyth_and_price")

// Register additional gauges and counters for migration and tracking purposes
const evmPriceGauage = Gauge.register("evm_price_unsafe", commonOptions)
const price_update_occur = Gauge.register("price_update_occur", commonOptions)
const price_update_counter = Counter.register("price_update_counter", {
  resolutionConfig: {
    intervalInMinutes: 5,
  }
})

// New counters for total and daily Pyth price updates
const totalPriceUpdates = Counter.register("total_price_updates")
const dailyPriceUpdates = Counter.register("daily_price_updates", {
  resolutionConfig: {
    intervalInMinutes: 1440, // 1440 minutes in a day
  }
})

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
  const symbol = PRICE_MAP.get(priceId) || "not listed"
  var isNative

  // Check if the price feed is native
  if (priceId == "0x23d7315113f5b1d3ba7a83604c44b94d79f4fd69af77f804fc7f920a6dc65744") {
    isNative = "true"
  } else {
    isNative = "false"
  }
  const labels = { priceId, symbol, isNative }

  // Record the price and EMA price
  priceGauage.record(ctx, getPrice(evt.data_decoded.price_feed.price), labels)
  evmPriceGauage.record(ctx, getPrice(evt.data_decoded.price_feed.price), labels)
  priceEMAGauage.record(ctx, getPrice(evt.data_decoded.price_feed.ema_price), labels)
  
  // Record the occurrence of a price update and increment the counter
  price_update_occur.record(ctx, ctx.timestamp.getTime(), labels)
  price_update_counter.add(ctx, 1, labels)

  // Increment total and daily counters
  totalPriceUpdates.add(ctx, 1)
  dailyPriceUpdates.add(ctx, 1, labels)
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

// import { event, price } from "./types/sui/0x8d97f1cd6ac663735be08d1d2b6d02a159e711586461306ce60a2b7a6a565a9e.js";

// import { event as oldEvent, price as oldPrice } from "./types/sui/0x00b53b0f4174108627fbee72e2498b58d6a2714cded53fac537034c220d26302.js";
// import { PRICE_MAP } from './pyth.js'
// import { Counter, Gauge, MetricOptions } from "@sentio/sdk";
// import { BigDecimal, AggregationType } from "@sentio/sdk";


// import LRU from 'lru-cache'

// // TO-DO
// // Total Number of Pyth Price Updates

// // Daily Number of Pyth Price Updates (by feed/asset type)

// // Daily & Total Number of Sponsored Price Updates

// // Daily & Total Number of Non-Sponsored Price Updates

// // List of Contract Addresses Using Pyth

// // List of Contract Addresses Using Pyth ranked by usage (number of price reads and updates)

// // Total Number of Unique User/Wallet Addresses Using Apps Powered By Pyth (daily and cumulative)

// // Total & Daily Fees paid by Price Update Requestor to the Pyth oracle

// // Total & Daily transactions costs incurred by Price Update Requestors

// const commonOptions: MetricOptions = {
//   sparse: true,
//   aggregationConfig: {
//     intervalInMinutes: [1],
//     types: [AggregationType.LAST]
//   }
// }
// const priceGauage = Gauge.register("price", commonOptions)
// const priceEMAGauage = Gauge.register("price_ema", commonOptions)

// const updates = Counter.register("update")
// const updateWithFunder = Counter.register("update_price_feeds_with_funder")
// const message = Counter.register("message")
// const messages2 = Counter.register("mint_with_pyth_and_price")

// // more migration
// const evmPriceGauage = Gauge.register("evm_price_unsafe", commonOptions)
// const price_update_occur = Gauge.register("price_update_occur", commonOptions)

// const price_update_counter = Counter.register("price_update_counter", {
//   resolutionConfig: {
//     intervalInMinutes: 5,
//   }
// })

// const cache = new LRU<bigint, any>({
//   maxSize: 5000,
//   sizeCalculation: (value, key) => {
//     return 1
//   },
// })

// event.bind({
// }).onEventPriceFeedUpdateEvent((evt, ctx) => {

//   const priceId = decodeBytesArray(evt.data_decoded.price_feed.price_identifier.bytes)
//   const symbol = PRICE_MAP.get(priceId) || "not listed"
//   var isNative

//   if (priceId == "0x23d7315113f5b1d3ba7a83604c44b94d79f4fd69af77f804fc7f920a6dc65744") {
//     isNative = "true"
//   } else {
//     isNative = "false"
//   }
//   const labels = { priceId, symbol, isNative }

//   priceGauage.record(ctx, getPrice(evt.data_decoded.price_feed.price), labels)
//   // migration
//   evmPriceGauage.record(ctx, getPrice(evt.data_decoded.price_feed.price), labels)
//   priceEMAGauage.record(ctx,  getPrice(evt.data_decoded.price_feed.ema_price), labels)
//   // updates.add(ctx, 1, labels)
//   //migration
//   price_update_occur.record(ctx, ctx.timestamp.getTime(), labels)

//   price_update_counter.add(ctx, 1, labels)
//   // ctx.meter.Counter("price_update_counter").add(1, labels)
// })

// // old contract at 0x00b53b0f4174108627fbee72e2498b58d6a2714cded53fac537034c220d26302
// oldEvent.bind({

// }).onEventPriceFeedUpdateEvent((evt, ctx) => {

//   const priceId = decodeBytesArray(evt.data_decoded.price_feed.price_identifier.bytes)
//   const symbol = PRICE_MAP.get(priceId) || "not listed"
//   var isNative

//   if (priceId == "0x23d7315113f5b1d3ba7a83604c44b94d79f4fd69af77f804fc7f920a6dc65744") {
//     isNative = "true"
//   } else {
//     isNative = "false"
//   }
//   const labels = { priceId, symbol, isNative }

//   priceGauage.record(ctx, getPrice(evt.data_decoded.price_feed.price), labels)
//   // migration
//   evmPriceGauage.record(ctx, getPrice(evt.data_decoded.price_feed.price), labels)
//   priceEMAGauage.record(ctx,  getPrice(evt.data_decoded.price_feed.ema_price), labels)
//   // updates.add(ctx, 1, labels)
//   //migration
//   price_update_occur.record(ctx, 1, labels)
//   price_update_counter.add(ctx, 1, labels)
//   // ctx.meter.Counter("price_update_counter").add(1, labels)
// })

// export function getPrice(p: price.Price) {
//   let expo = p.expo.magnitude.asBigDecimal()
//   if (p.expo.negative) {
//     expo = expo.negated()
//   }
//   let base = p.price.magnitude.asBigDecimal()
//   if (p.price.negative) {
//     base = base.negated()
//   }
//   return base.multipliedBy(BigDecimal(10).exponentiatedBy(expo))
// }

// function decodeBytesArray(bytes: number[]): string {
//   return "0x" + Buffer.from(bytes).toString("hex")
// }