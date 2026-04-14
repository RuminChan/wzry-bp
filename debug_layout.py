import sys, time, json, traceback
sys.path.insert(0, r'E:\Program Files\QClaw\resources\openclaw\config\skills\browser-cdp\scripts')

out = r'C:\Users\Administrator\.qclaw\workspace-agent-f402ca11\debug.txt'

try:
    from cdp_client import CDPClient
    cdp_url = 'http://127.0.0.1:9223'
    client = CDPClient(cdp_url)
    client.connect()
    
    tabs = client.list_tabs()
    tab = None
    for t in tabs:
        if '5179' in t.get('url', ''):
            tab = t
            break
    
    if not tab:
        with open(out, 'w') as f:
            f.write('No tab found. Tabs: ' + json.dumps(tabs, ensure_ascii=False))
        sys.exit(0)
    
    client.attach(tab['id'])
    
    # Get the layout info via JS evaluation
    result = client.send('Runtime.evaluate', {
        'expression': """
        (function() {
            var layout = document.querySelector('.bp-layout');
            if (!layout) return 'NO bp-layout element found';
            var rect = layout.getBoundingClientRect();
            var children = layout.children;
            var info = 'bp-layout: ' + rect.width + 'x' + rect.height + '\\n';
            info += 'computed: ' + getComputedStyle(layout).display + ' / ' + getComputedStyle(layout).gridTemplateColumns + '\\n';
            for (var i = 0; i < children.length; i++) {
                var c = children[i];
                var r = c.getBoundingClientRect();
                var cs = getComputedStyle(c);
                info += c.className + ': ' + r.width + 'x' + r.height + ' at(' + r.left + ',' + r.top + ') display=' + cs.display + '\\n';
            }
            return info;
        })()
        """,
        'returnByValue': True
    })
    
    with open(out, 'w', encoding='utf-8') as f:
        f.write(json.dumps(result, ensure_ascii=False, indent=2))
        
except Exception as e:
    with open(out, 'w', encoding='utf-8') as f:
        f.write(traceback.format_exc())
