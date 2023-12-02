require('dotenv/config');
const { Client } = require('discord.js');
const { OpenAI } = require('openai');

const client = new Client({
    intents: ['Guilds', 'GuildMembers', 'GuildMessages', 'MessageContent']
});

const userContexts = {}; // User-specific conversation contexts
const MAX_HISTORY_LENGTH = 50; // Maximum length of history per user

client.on('ready', () => {
    console.log('The bot is online');
});

const IGNORE_PREFIX = "!";
const CHANNELS = ['1179954573226553475'];

const openai = new OpenAI({
    apiKey: process.env.OPENAI_KEY,
});

client.on('messageCreate', async (message) => {
    console.log(`Received message: ${message.content}`); // Debugging
    if (message.author.bot) return;
    if (message.content.startsWith(IGNORE_PREFIX)) return;
    if (!CHANNELS.includes(message.channelId) || !message.mentions.users.has(client.user.id)) return;

    await message.channel.sendTyping();
    const sendTypingInterval = setInterval(() => {
        message.channel.sendTyping();
    }, 5000);

    const userId = message.author.id;
    if (!userContexts[userId]) {
        userContexts[userId] = [{
            role: 'system',
            content: 'Chat gpt is a friendly bot that likes to talk trash in a friendly way sometimes.'
        }];
    }
    let conversation = userContexts[userId];

    let prevMessages = await message.channel.messages.fetch({ limit: 10 });
    prevMessages = prevMessages.filter(msg => !msg.author.bot || msg.author.id === client.user.id);
    prevMessages = prevMessages.filter(msg => !msg.content.startsWith(IGNORE_PREFIX));
    prevMessages = Array.from(prevMessages.values()).reverse();

    prevMessages.forEach((msg) => {
        const username = msg.author.username.replace(/\s+/g, '_').replace(/[^\w\s]/gi, '');
        conversation.push({
            role: msg.author.id === client.user.id ? 'assistant' : 'user',
            name: username,
            content: msg.content,
        });
    });

    const response = await openai.chat.completions
        .create({
            model: 'gpt-4',
            max_tokens: 256,
            messages: conversation,
        })
        .catch((error) => {
            console.error('OpenAI Error:\n', error);
            return null;
        });
    clearInterval(sendTypingInterval);

    if (!response) {
        message.reply("Something is broken, my B.");
        return;
    }

    const openaiResponse = response.choices[0].message.content;
    userContexts[userId].push({
        role: 'assistant',
        content: openaiResponse
    });
    pruneConversationHistory(userId);

    message.reply(openaiResponse);
});

function pruneConversationHistory(userId) {
    if (userContexts[userId].length > MAX_HISTORY_LENGTH) {
        userContexts[userId] = userContexts[userId].slice(-MAX_HISTORY_LENGTH);
    }
}

client.login(process.env.TOKEN);
