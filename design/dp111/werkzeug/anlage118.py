import sys,numpy as np; sys.path.insert(0,'/home/claude/hefta/d118')
import luecke118 as l, ansichten118 as an
mitte,kern,g=l.linien(an.A1,'A1')
dp=np.array([[60,y] for y in range(150,900,25)],float)
for n in ('design-540','bau-540','design-180','bau-174','design-120','bau-116'):
    q,m=l.tiefe(f'/home/claude/hefta/d118/anlage/kachel/{n}.png',mitte,kern,dp); print(n.ljust(11),'Lückentiefe 10 %-Quantil',round(float(q),2),' kleinster Wert',round(float(m),2))
