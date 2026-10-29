  403430: 51                           	push	ecx
  403431: 53                           	push	ebx
  403432: 55                           	push	ebp
  403433: 8b e9                        	mov	ebp, ecx
  403435: 56                           	push	esi
  403436: 57                           	push	edi
  403437: 8b f2                        	mov	esi, edx
  403439: 66 8b 7d 46                  	mov	di, word ptr [ebp + 0x46]
  40343d: 66 8b 5d 48                  	mov	bx, word ptr [ebp + 0x48]
  403441: 85 ed                        	test	ebp, ebp
  403443: 75 0f                        	jne	0x403454 <.text+0x2454>
  403445: ba 9f 07 00 00               	mov	edx, 0x79f
  40344a: b9 90 c0 40 00               	mov	ecx, 0x40c090
  40344f: e8 ec dd ff ff               	call	0x401240 <.text+0x240>
  403454: 85 f6                        	test	esi, esi
  403456: 75 0f                        	jne	0x403467 <.text+0x2467>
  403458: ba a0 07 00 00               	mov	edx, 0x7a0
  40345d: b9 90 c0 40 00               	mov	ecx, 0x40c090
  403462: e8 d9 dd ff ff               	call	0x401240 <.text+0x240>
  403467: 8b 45 1c                     	mov	eax, dword ptr [ebp + 0x1c]
  40346a: 8b 4e 0c                     	mov	ecx, dword ptr [esi + 0xc]
  40346d: 3b c1                        	cmp	eax, ecx
  40346f: 74 0f                        	je	0x403480 <.text+0x2480>
  403471: ba a1 07 00 00               	mov	edx, 0x7a1
  403476: b9 90 c0 40 00               	mov	ecx, 0x40c090
  40347b: e8 c0 dd ff ff               	call	0x401240 <.text+0x240>
  403480: 66 8b 46 08                  	mov	ax, word ptr [esi + 0x8]
  403484: 66 85 c0                     	test	ax, ax
  403487: 89 44 24 10                  	mov	dword ptr [esp + 0x10], eax
  40348b: 75 1b                        	jne	0x4034a8 <.text+0x24a8>
  40348d: 66 85 ff                     	test	di, di
  403490: 7d 0a                        	jge	0x40349c <.text+0x249c>
  403492: c7 44 24 10 ff ff ff ff      	mov	dword ptr [esp + 0x10], 0xffffffff
  40349a: eb 0c                        	jmp	0x4034a8 <.text+0x24a8>
  40349c: 33 c9                        	xor	ecx, ecx
  40349e: 66 85 ff                     	test	di, di
  4034a1: 0f 9f c1                     	setg	cl
  4034a4: 89 4c 24 10                  	mov	dword ptr [esp + 0x10], ecx
  4034a8: 8b 4c 24 10                  	mov	ecx, dword ptr [esp + 0x10]
  4034ac: 0f af cf                     	imul	ecx, edi
  4034af: 66 85 db                     	test	bx, bx
  4034b2: 7e 05                        	jle	0x4034b9 <.text+0x24b9>
  4034b4: 0f bf d3                     	movsx	edx, bx
  4034b7: eb 02                        	jmp	0x4034bb <.text+0x24bb>
  4034b9: 33 d2                        	xor	edx, edx
  4034bb: 0f bf 46 06                  	movsx	eax, word ptr [esi + 0x6]
  4034bf: 0f af c2                     	imul	eax, edx
  4034c2: 99                           	cdq
  4034c3: 2b c2                        	sub	eax, edx
  4034c5: d1 f8                        	sar	eax
  4034c7: 66 3b c8                     	cmp	cx, ax
  4034ca: 7e 11                        	jle	0x4034dd <.text+0x24dd>
  4034cc: 0f bf c9                     	movsx	ecx, cx
  4034cf: 0f bf c0                     	movsx	eax, ax
  4034d2: 83 c1 fe                     	add	ecx, -0x2
  4034d5: 3b c1                        	cmp	eax, ecx
  4034d7: 7e 18                        	jle	0x4034f1 <.text+0x24f1>
  4034d9: 8b d0                        	mov	edx, eax
  4034db: eb 16                        	jmp	0x4034f3 <.text+0x24f3>
  4034dd: 0f bf 56 04                  	movsx	edx, word ptr [esi + 0x4]
  4034e1: 0f bf c9                     	movsx	ecx, cx
  4034e4: 0f bf c0                     	movsx	eax, ax
  4034e7: 03 ca                        	add	ecx, edx
  4034e9: 3b c1                        	cmp	eax, ecx
  4034eb: 7d 04                        	jge	0x4034f1 <.text+0x24f1>
  4034ed: 8b d0                        	mov	edx, eax
  4034ef: eb 02                        	jmp	0x4034f3 <.text+0x24f3>
  4034f1: 8b d1                        	mov	edx, ecx
  4034f3: 66 8b 46 02                  	mov	ax, word ptr [esi + 0x2]
  4034f7: 66 3b d8                     	cmp	bx, ax
  4034fa: 7e 0f                        	jle	0x40350b <.text+0x250b>
  4034fc: 0f bf cb                     	movsx	ecx, bx
  4034ff: 0f bf c0                     	movsx	eax, ax
  403502: 83 c1 fe                     	add	ecx, -0x2
  403505: 3b c1                        	cmp	eax, ecx
  403507: 7f 13                        	jg	0x40351c <.text+0x251c>
  403509: eb 0f                        	jmp	0x40351a <.text+0x251a>
  40350b: 0f bf 0e                     	movsx	ecx, word ptr [esi]
  40350e: 0f bf f3                     	movsx	esi, bx
  403511: 0f bf c0                     	movsx	eax, ax
  403514: 03 ce                        	add	ecx, esi
  403516: 3b c1                        	cmp	eax, ecx
  403518: 7c 02                        	jl	0x40351c <.text+0x251c>
  40351a: 8b c1                        	mov	eax, ecx
  40351c: 8b 4c 24 10                  	mov	ecx, dword ptr [esp + 0x10]
  403520: 66 89 45 48                  	mov	word ptr [ebp + 0x48], ax
  403524: 0f af ca                     	imul	ecx, edx
  403527: 5f                           	pop	edi
  403528: 66 89 4d 46                  	mov	word ptr [ebp + 0x46], cx
  40352c: 8b c5                        	mov	eax, ebp
  40352e: 5e                           	pop	esi
  40352f: 5d                           	pop	ebp
  403530: 5b                           	pop	ebx
  403531: 59                           	pop	ecx
  403532: c3                           	ret
