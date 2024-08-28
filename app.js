const express = require('express');
const ejs = require('ejs');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const TelegramBot = require('node-telegram-bot-api');

const app = express();
app.use(bodyParser.json());
app.use(express.static('public'));
app.set('view engine', 'ejs');

const botToken = '7527478831:AAE6G4dKdghzRVQsWAJnR--syKZxJHmi5bU';
const bot = new TelegramBot(botToken, {polling: true});
bot.getUpdates({ offset: -1 });

mongoose.connect('mongodb+srv://fawazogunleye:Aabimbola2022@cluster0.caz9xfe.mongodb.net/appheirstonhon?retryWrites=true&w=majority&appName=Cluster0');

const userSchema = new mongoose.Schema({
    telegramId: {
        type: String,
        unique: true
    },
    username: {
        type: String,
        unique: true
    },
    balance: {
        type: Number,
    },
    nextClaimTime: {
        type: Date,
        default: Date.now()
    },
    completedTasks: {
        type: Array        
    },
    referredBy: {
        type: String
    },
    referredUsers: [{type: String}]
});
const User = new mongoose.model('User', userSchema);

bot.onText(/\/start(?:\s+(.+))?/, async (msg, match) => {
    const chatId = msg.chat.id.toString(); // Convert to string for MongoDB consistency
    const referralCode = match[1]; // Capture the referral code, if provided
    const username = msg.chat.username;
    try {
        // Check if the user already exists in the database
        let user = await User.findOne({ telegramId: chatId });

        if (!user) {
            // If the user doesn't exist, create a new user
            user = new User({ telegramId: chatId, username: username, balance: 0,  referredBy: referralCode || null });

            if (referralCode) {
                // If there is a referral code, find the referrer and add this user to their referredUsers list
                const referrer = await User.findOne({ telegramId: referralCode });

                if (referrer) {    
                    referrer.referredUsers.push(chatId);
                    referrer.balance = (referrer.balance || 0) + 1000;
                    await referrer.save();
                }
            }

            await user.save();
            bot.sendMessage(chatId, referralCode ? `Welcome! You were referred by user ${referralCode}.` : 'Welcome!');
        } else {
            bot.sendMessage(chatId, `Welcome back!: ${chatId}`);
        }
    } catch (error) {
        console.error('Error handling /start command:', error);
        bot.sendMessage(chatId, 'Sorry, something went wrong. Please try again later.');
    }
});
app.get('/', (req, res) => {
    res.render('index');
});
app.post('/send-telegram-data', async (req, res) => {
    const { user } = req.body;

    try {
        // Check if the user already exists in the database
        const existingUser = await User.findOne({ telegramId: user.id });

        if (existingUser) {
            // User exists, construct the redirect URL
            const redirectUrl = `/dashboard?telegramId=${user.id}&firstName=${user.first_name}&lastName=${user.last_name || 'N/A'}&username=${user.username || 'N/A'}&languageCode=${user.language_code || 'N/A'}`;

            // Respond with a JSON object containing the redirect URL
            res.json({ redirectUrl });
        } else {
            // User doesn't exist, which might be an error if we expect the bot to handle saving users
            console.error('User data received but not found in the database:', user.id);
            res.status(400).send('User not found');
        }
    } catch (error) {
        console.error('Error processing /send-telegram-data:', error);
        res.status(500).send('Internal server error');
    }
});

app.get('/dashboard', async (req, res) => {
    const { telegramId } = req.query;

    try {
        // Fetch the user details from the database using the telegramId
        const user = await User.findOne({ telegramId });

        if (user) {
            // Render the dashboard with the user's details
            res.render('dashboard', {
                username: user.username,
                balance: user.balance, 
                referredUsers: user.referredUsers.length
            });
        } else {
            // If user not found, send a 404 error
            res.status(404).send('User not found');
        }
    } catch (error) {
        console.error('Error retrieving user data for dashboard:', error);
        res.status(500).send('Internal server error');
    }
});
app.listen(3000, () => {
    console.log(`server started by xoxo`);
})
