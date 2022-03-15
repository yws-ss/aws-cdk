import os
import json
from collections import defaultdict
dirs = os.listdir(os.getcwd())
dic = defaultdict(lambda: [])
f = open(os.getcwd() + "/.jsii")
data = json.load(f)
for mt in data["types"]:
  myType = data["types"][mt]
  if myType["docs"]["stability"] == "deprecated":
    continue
  loc = myType["locationInModule"]
  filename = loc["filename"]
  line = loc["line"]

  if filename != "lib/domain.ts":
    continue

  dic[filename].append(line)
  
  if "methods" in myType:
    for method in myType["methods"]:
      mloc = method["locationInModule"]
      mfilename = mloc["filename"]
      mline = mloc["line"]
      dic[mfilename].append(mline)
  if "properties" in myType:
    for prop in myType["properties"]:
      ploc = prop["locationInModule"]
      pfilename = ploc["filename"]
      pline = ploc["line"]
      dic[pfilename].append(pline)


for aFile in dic:
  dic[aFile].sort(reverse=True)
  with open(os.getcwd() + '/' + aFile, "r") as af:
    data = af.readlines()
  
  for line in dic[aFile]:
    linewewant = line-3
    leadingSpaces = len(data[linewewant]) - len(data[linewewant].lstrip())
    if len(data[linewewant])-1 < leadingSpaces + 2 or data[linewewant][leadingSpaces+2] == '@':
      data[linewewant] = data[linewewant] + (" " * leadingSpaces) + "* @deprecated use opensearchservice module instead\n"
    else:
      data[linewewant] = data[linewewant] + (" " * leadingSpaces) + "*\n" + (" " * leadingSpaces) + "* @deprecated use opensearchservice module instead\n"

  with open(os.getcwd() + '/' + aFile, "w") as wf:
    wf.writelines(data)

  
# for dir in dirs:
    
#   f = open(os.getcwd() + "/" + dir + "/package.json")
#   data = json.load(f)
#   if "jsii" in data:
#     if "metadata" in data["jsii"]:
#       print(data["name"], data["jsii"]["metadata"])
#     else:
#       print(data["name"], "nope")
#       data["jsii"]["metadata"] = metadata
#   else:
#     print(data["name"], "has no jsii!!")

#   f.close()

#   f = open(os.getcwd() + "/" + dir + "/package.json", "w")
#   json.dump(data, f, indent=2)
#   f.write("\n")
#   f.close()