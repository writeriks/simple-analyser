require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const { OpenAI } = require('openai');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SOURCE_CHANNEL = process.env.NINJA_NEWS_CHANNEL_ID;
const REPLY_CHANNEL = process.env.REPLY_CHANNEL_ID;

client.once('ready', () => {
  console.log(`🤖 Logged in as ${client.user.tag}`);
});

let tweetBuffer = [];
let bufferTimer = null;

const FILTER_KEYWORDS = [
    // FAANG stocks
    'facebook', 'meta', 'apple', 'amazon', 'netflix', 'google', 'alphabet', 'tesla', 'strategy',
  
    // Abbreviations
    'fb', 'aapl', 'amzn', 'nflx', 'goog', 'googl', 'tsla', 'mstr',
  
    // Central Banks / Regulators
    'fed', 'federal reserve', 'ecb', 'central bank', 'sec', 'interest rate', 'rate hike', 'inflation',
  
    // Crypto & related
    'crypto', 'bitcoin', 'btc', 'ethereum', 'eth', 'solana', 'sol', 'doge', 'xrp', 'binance', 'bnb', 'cme', 'coinbase', 'kraken', 'blockchain', 'stablecoin', 'usd tether', 'usdt', 'usd coin', 'usdc',
    'digital currency', 'cryptocurrency', 'decentralized finance', 'defi', 'nft', 'non-fungible token', 'web3'
  ];

  function matchesFilter(text) {
    const lowerText = text.toLowerCase();

    return FILTER_KEYWORDS.some((keyword) => {
       const pattern = new RegExp(`\\b${keyword}\\b`, 'i');
       const isMatch = pattern.test(lowerText)
       if(isMatch) {
        console.log("Matched keyword:", keyword);
        return true; 
        }
      return false;
    });
  }
  

client.on('messageCreate', async (message) => {
  if (message.channel.id !== SOURCE_CHANNEL) return;

  const embed = message.embeds?.[0];

  const tweetText = embed?.description;
  if (!tweetText) return;

  // ✅ NEW: Filter only relevant tweets
  if (!matchesFilter(tweetText)) {
    console.log("Skipped tweet (no keyword match):", tweetText);
    return;
  }
  
  // Add to buffer
  tweetBuffer.push(tweetText);

  // Reset timer
  if (bufferTimer) clearTimeout(bufferTimer);

  // Wait 5 seconds after last message before processing
  bufferTimer = setTimeout(async () => {
    const combinedText = tweetBuffer.map((t, i) => `${i + 1}. ${t}`).join("\n\n");
    
    tweetBuffer = []; // Reset buffer

    try {
      const completion = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [
      {
      role: "system",
      content: `You are a financial market assistant. Given a list of tweet headlines, return:

      1. A clear **investment recommendation** per asset or topic: Buy / Sell / Neutral.
      2. A brief summary of the sentiment and why.

      Be concise, accurate, and avoid hype. Format output clearly.
      Use emojis for clear understanding`
    },
    {
      role: "user",
      content: `Tweets:\n${combinedText}`
    }
        ]
      });

      const result = completion.choices[0].message.content;
      const formattedMessage = `🧵 **Tweets Analyzed:**\n${tweetBuffer.map((t, i) => `${i + 1}. ${t}`).join("\n")}

      📊 Bulk Tweet Analysis:\n${result}`;
      
      const replyChannel = await client.channels.fetch(REPLY_CHANNEL);
      replyChannel.send(`${formattedMessage}`);
    } catch (err) {
      console.error("❌ OpenAI error:", err);
    }
  }, 5000); // Adjust time if needed
});

client.login(process.env.DISCORD_TOKEN);
