# IronHost Agent Setup & Architecture Guide

## 1. System Architecture
- **Frontend**: [https://iron-host.vercel.app](https://iron-host.vercel.app) (Public Vercel Deployment)
- **Master API**: [https://ironhost-master.onrender.com](https://ironhost-master.onrender.com) (Public Render Deployment)
- **Agent**: Your Local PC (Private Localhost)

## 2. Ports
- **Frontend**: Standard HTTPS (443) -> Calls Master API
- **Master**: Standard HTTPS (443) -> Forwards to internal port 8080
- **Agent**: Listens on `8443` (TCP) locally

## 3. How to Connect
Since your Agent is on your local PC and the Master is on the cloud (Render), the Master cannot see your `localhost`. You must use **Ngrok** to create a public tunnel.

### Step 1: Run Agent (Git Bash)
You must use `./` to run executables in the current directory in Bash.

```bash
cd services/agent
# Note: Use ./agent.exe
./agent.exe -insecure -token Zu4sytTm0SsgYm0pKOjphjZbQthj3qGW -port 8443
```

*If you see "permission denied", run `chmod +x agent.exe` first.*

### Step 2: Start Ngrok (New Terminal)
This exposes your local port 8443 to the internet.

```bash
ngrok tcp 8443
```
Copy the forwarding URL (e.g., `tcp://0.tcp.ngrok.io:12345`).

### Step 3: Add Node in Dashboard
Go to the Frontend Dashboard > **Nodes > Add Node**:
- **Name**: My PC
- **FQDN**: `0.tcp.ngrok.io` (The URL **without** `tcp://`)
- **Port**: `12345` (The port Ngrok gave you, **NOT** 8443)
- **Token**: `Zu4sytTm0SsgYm0pKOjphjZbQthj3qGW`

Once added, the Master will connect to Ngrok, which tunnels the request to your local Agent!
