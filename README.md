# LEAGUEbuddy 🏀

A Discord bot for managing basketball league operations, recruiting, and team management.

## Features

- **Staff Commands**: Administrative functions for league staff
- **Coach Commands**: Team management tools for coaches  
- **League Data Management**: JSON-based data storage for teams, recruits, and scouting
- **Role-based Command Access**: Separate command categories for staff and coaches

## Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/bgordon0102/LEAGUEbuddy.git
   cd LEAGUEbuddy
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   Create a `.env` file in the root directory:
   ```env
   TOKEN=your_discord_bot_token
   CLIENT_ID=your_application_client_id
   GUILD_ID=your_server_guild_id
   ```

4. **Deploy commands to Discord**
   ```bash
   node deploy-commands.js
   ```

5. **Start the bot**
   ```bash
   node app.js
   ```

## Commands

### Staff Commands
- `/ping` - Test bot responsiveness

### Coach Commands  
- `/hello` - Greeting command for coaches

## Project Structure

```
LEAGUEbuddy/
├── src/
│   ├── commands/
│   │   ├── staff/          # Staff-only commands
│   │   └── coach/          # Coach-only commands
│   └── handler.js          # Command loading system
├── data/                   # League data storage
│   ├── league.json
│   ├── teams.json
│   ├── recruits.json
│   └── scouting.json
├── app.js                  # Main bot application
├── deploy-commands.js      # Command registration
└── package.json
```

## Development

This bot uses Discord.js v14 and ES modules. Add new commands by creating files in the appropriate `src/commands/` subdirectory.

## License

ISC

A Discord bot for league management.
