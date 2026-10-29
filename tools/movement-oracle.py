"""Interpret the disassembled original integer routine, not the port's formulas.
Only the instruction subset actually used at 0x403430..0x403532 is admitted.
This is an isolated arithmetic oracle, not a Windows game runtime.
"""
import pathlib,re,struct,json,hashlib,random,argparse
root=pathlib.Path(__file__).resolve().parents[1]
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('executable',type=pathlib.Path,help='Path to the matching SkiFree 1.04 executable')
args=parser.parse_args()
binary=args.executable.read_bytes()
source_hash=hashlib.sha256(binary).hexdigest()
assert source_hash=='3572d3757638bc1ae388c3d007ba59ba1f370911901e2a35d2f1297e8cf0ff35'
program={}
for line in (root/'tests/fixtures/movement.asm').read_text().splitlines():
 m=re.match(r'\s*([0-9a-f]+):\s+((?:[0-9a-f]{2}\s+)+)\s*([a-z]+)\s*(.*)',line)
 if not m:continue
 address=int(m[1],16)
 if 0x403430<=address<=0x403532:
  raw=bytes.fromhex(m[2]);assert raw==binary[address-0x400000:address-0x400000+len(raw)]
  program[address]=(address+len(raw),m[3],m[4])
def signed(n,bits=32):
 n&=(1<<bits)-1
 return n-(1<<bits) if n&(1<<(bits-1)) else n
aliases={'ax':('eax',16),'bx':('ebx',16),'cx':('ecx',16),'dx':('edx',16),'di':('edi',16),'si':('esi',16),'cl':('ecx',8)}
def oracle(state,vx,vy):
 regs={name:0 for name in ['eax','ebx','ecx','edx','esi','edi','ebp','esp']}
 regs.update(ecx=0x10000,edx=0x40a308+state*16,esp=0x20000)
 mem={}
 def write(addr,value,size):
  for i in range(size):mem[addr+i]=(value>>(i*8))&255
 def read(addr,size):
  return sum((mem.get(addr+i,binary[addr-0x400000+i] if 0x400000<=addr+i<0x400000+len(binary) else 0))<<(i*8) for i in range(size))
 write(0x1001c,state,4);write(0x10046,vx,2);write(0x10048,vy,2)
 def addr(s):
  s=s[s.index('[')+1:s.index(']')].replace(' ','')
  result=0
  for token in re.findall(r'[+-]?[^+-]+',s):
   sign=-1 if token[0]=='-' else 1;t=token.lstrip('+-')
   result+=sign*(regs[t] if t in regs else int(t,0))
  return result&0xffffffff
 def get(s):
  s=s.strip()
  if '[' in s:
   size=1 if s.startswith('byte') else 2 if s.startswith('word') else 4
   return read(addr(s),size),size*8
  if s in aliases:r,b=aliases[s];return regs[r]&((1<<b)-1),b
  if s in regs:return regs[s],32
  return int(s,0)&0xffffffff,32
 def put(s,value):
  s=s.strip()
  if '[' in s:
   size=1 if s.startswith('byte') else 2 if s.startswith('word') else 4
   write(addr(s),value,size);return
  if s in aliases:
   r,b=aliases[s];mask=(1<<b)-1;regs[r]=(regs[r]&~mask)|(value&mask)
  else:regs[s]=value&0xffffffff
 pc=0x403430;condition=0;steps=0
 while True:
  steps+=1;assert steps<300
  nxt,op,args=program[pc];parts=[p.strip() for p in args.split(',')];dest=parts[0] if parts else ''
  if op=='ret':break
  if op=='push':regs['esp']-=4;write(regs['esp'],get(dest)[0],4)
  elif op=='pop':put(dest,read(regs['esp'],4));regs['esp']+=4
  elif op=='mov':put(dest,get(parts[1])[0])
  elif op=='movsx':v,b=get(parts[1]);put(dest,signed(v,b))
  elif op=='test':a,b=get(dest);v=get(parts[1])[0];condition=signed(a&v,b)
  elif op=='cmp':a,b=get(dest);v=get(parts[1])[0];condition=signed(a,b)-signed(v,b)
  elif op in ('add','sub','xor','or','imul'):
   a,b=get(dest);v=get(parts[1])[0]
   result={'add':lambda:a+v,'sub':lambda:a-v,'xor':lambda:a^v,'or':lambda:a|v,'imul':lambda:signed(a,b)*signed(v,b)}[op]()
   put(dest,result);condition=signed(result,b)
  elif op=='sar':a,b=get(dest);n=get(parts[1])[0] if len(parts)>1 else 1;put(dest,signed(a,b)>>n)
  elif op=='cdq':regs['edx']=0xffffffff if regs['eax']&0x80000000 else 0
  elif op=='setg':put(dest,int(condition>0))
  elif op in ('jne','je','jge','jg','jle','jl','jmp'):
   take={'jne':condition!=0,'je':condition==0,'jge':condition>=0,'jg':condition>0,'jle':condition<=0,'jl':condition<0,'jmp':True}[op]
   if take:nxt=int(dest.split()[0],16)
  elif op=='call':raise AssertionError('An original invariant assertion fired')
  else:raise AssertionError((hex(pc),op,args))
  pc=nxt
 return [signed(read(0x10046,2),16),signed(read(0x10048,2),16)]
rng=random.Random(1991);samples=[]
for state in range(22):
 for vx,vy in [(0,0),(-8,0),(8,0),(0,16),(12,24),(-16,12),(0,-4)]+[(rng.randint(-30,30),rng.randint(-10,40)) for _ in range(24)]:
  samples.append({'state':state,'vx':vx,'vy':vy,'expected':oracle(state,vx,vy)})
out={'sourceSha256':source_hash,'routine':'0x403430..0x403532','method':'bounded interpreter of objdump instructions, instruction bytes matched against original PE','samples':samples}
(root/'tests/fixtures/movement.json').write_text(json.dumps(out,indent=2))
print('Generated',len(samples),'original-instruction movement fixtures')
