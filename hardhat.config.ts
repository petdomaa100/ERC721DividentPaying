import { HardhatUserConfig } from 'hardhat/config';
import * as dotenv from 'dotenv';

import '@nomiclabs/hardhat-etherscan';
import '@nomiclabs/hardhat-waffle';
import '@typechain/hardhat';
import 'hardhat-gas-reporter';
import 'solidity-coverage';

import './tasks';


dotenv.config();


const config: HardhatUserConfig = {
	solidity: '0.8.12',
	mocha: {
		parallel: false
	},
	networks: {
		ropsten: {
			url: process.env.ROPSTEN_URL || '',
			accounts: !!process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : []
		},
	},
	gasReporter: {
		enabled: process.env.REPORT_GAS === 'true',
		currency: 'USD',
		showTimeSpent: true,
		coinmarketcap: process.env.COINMARKETCAP_API_KEY || undefined
	},
	etherscan: {
		apiKey: process.env.ETHERSCAN_API_KEY
	}
};



export default config;