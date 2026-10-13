import re,sys
for sysid in sys.argv[1:]:
    p=f'out/regress/{sysid}/system/index.html'
    s=open(p,encoding='utf-8').read()
    i=s.find('<nav class="sp-nav"')
    head,rest=s[:i],s[i:]
    rest=re.sub(r'(<div class="sp-head">.*?</div>\s*</?h2[^>]*>.*?</h2></div>)', lambda m: re.sub(r' data-ds-enter="[^"]*"','',m.group(1)), rest)
    head=head.replace('</head>','<link rel="stylesheet" href="/_proto/system-v2.css"></head>',1)
    rest=rest.replace('</body>','<script src="/_proto/system-v2.js"></script></body>',1)
    open(f'out/regress/{sysid}/system/proto.html','w',encoding='utf-8').write(head+rest)
    print(sysid, rest.count('data-ds-enter'))
