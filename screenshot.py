import sys, time
sys.path.insert(0, r'E:\Program Files\QClaw\resources\openclaw\config\skills\browser-cdp\scripts')
from browser_launcher import BrowserLauncher
from cdp_client import CDPClient
from browser_actions import BrowserActions
from page_snapshot import PageSnapshot

launcher = BrowserLauncher()
cdp_url = launcher.launch(browser='chrome')
print(f'CDP_URL: {cdp_url}', flush=True)

client = CDPClient(cdp_url)
client.connect()

# Find or create tab for localhost:5179
tabs = client.list_tabs()
tab = None
for t in tabs:
    if '5179' in t.get('url', ''):
        tab = t
        break

if tab:
    client.attach(tab['id'])
else:
    tab = client.create_tab('http://localhost:5179')
    client.attach(tab['id'])
    time.sleep(3)

actions = BrowserActions(client, PageSnapshot(client))
actions.wait_for_load()
time.sleep(1)
actions.screenshot(r'C:\Users\Administrator\.qclaw\workspace-agent-f402ca11\bp_layout.png')
print('Screenshot saved', flush=True)
