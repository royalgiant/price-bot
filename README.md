# price-bot

## Install NPM

1. Open up a terminal window.
2. Make sure npm is installed. You should have npm installed if you're using nvm otherwise `brew install npm`
3. `node -v` make sure the version is > 10

### Get an Infura Key.

1. Go to [Infura](https://infura.io/dashboard/ethereum) and sign up!
2. Go to your [Dashboard](https://infura.io/dashboard/ethereum) after signing up and "Create New Project"
3. Open up that Project and go to "Settings", which will have your Project ID, Secret, etc.
4. Copy the `https://mainnet.infura.io/v3/{your_key_here}` under Keys > Endpoints

### Clone this Repo with Git Clone To Wherever You Want
1. In your terminal, do `cd ~/Developer`, that is where I put my coding projects.
2. Do `git clone https://github.com/royalgiant/price-bot.git`.
3. Cd into the repo `cd ~/Developer/price-bot`

### Update Your Env File.
1. This repo has a `.env.example` file.
2. Rename it to `.env`
3. Replace the value in `RPC_URL` with the infura link you copied i.e. `https://mainnet.infura.io/v3/{your_key_here}` 

### Run the Price Bot
1. `node index2.js` to start the project.
2. You are done. CSVs are saved in price-bot's folder

### If you want new token pairs
1. It's all in the `monitorPrice()` function
2. Copy and paste the `await checkPair` function inside the `monitorPrice()` function
3. All you will be editing is `outputTokenAddress` and `outputTokenSymbol`
4. You can find the `outputTokenAddress` by dropping the SYMBOL (i.e. DAI) on [Etherscan](https://etherscan.io/token/0xdd974d5c2e2928dea5f71b9825b8b646686bd200) (use this KNC for an example)
