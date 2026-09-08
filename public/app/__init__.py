# test='1234'
# test=['uni','bi','tri','quad','penta','hexa']
# test=range(5)
# for i in test:
#     print(i)

print(*list(map(lambda d,x:f"{d}*{x}= {d*x}",[int(input("구구단 단수: "))]*9,range(1,10))),sep='\n')

print('\n\n')

for i in range(9):
    if i == 0:
        for j in range(9):
            print(f"{str(j+1)+'단':-^10}",end='\t')
        print()
    for j in range(9):
        print(f"{j+1} * {i+1} = {(j+1)*(i+1):>2}",end='\t')
    print()