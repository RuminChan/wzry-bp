import sys, time, json
sys.path.insert(0, r'E:\Program Files\QClaw\resources\openclaw\config\skills\browser-cdp\scripts')
from browser_launcher import BrowserLauncher
from cdp_client import CDPClient
from page_snapshot import PageSnapshot

cdp_url = 'http://127.0.0.1:9223'
client = CDPClient(cdp_url)
client.connect()

tabs = client.list_tabs()
tab = None
for t in tabs:
    if '5179' in t.get('url', ''):
        tab = t
        break

if tab:
    client.attach(tab['id'])
else:
    with open(r'C:\Users\Administrator\.qclaw\workspace-agent-f402ca11\tree.txt', 'w', encoding='utf-8') as f:
        f.write('No tab found')
    sys.exit(1)

snapshot = PageSnapshot(client)
tree = snapshot.accessibility_tree()
with open(r'C:\Users\Administrator\.qclaw\workspace-agent-f402ca11\tree.txt', 'w', encoding='utf-8') as f:
    f.write(tree[:12000])
