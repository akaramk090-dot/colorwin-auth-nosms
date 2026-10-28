from pathlib import Path
import urllib.request,zipfile,concurrent.futures
root=Path(__file__).resolve().parent.parent/'.tools'/'android';root.mkdir(parents=True,exist_ok=True)
items=[('jdk','https://aka.ms/download-jdk/microsoft-jdk-17.0.20.1-windows-x64.zip'),('build','https://dl.google.com/android/repository/build-tools_r34-windows.zip'),('platform','https://dl.google.com/android/repository/platform-34-ext12_r01.zip')]
def fetch(item):
 name,url=item;dest=root/name;archive=root/(name+'.zip')
 if dest.exists():return name+' ready'
 urllib.request.urlretrieve(url,archive);dest.mkdir()
 with zipfile.ZipFile(archive) as z:
  for entry in z.infolist():
   target=(dest/entry.filename).resolve()
   if not target.is_relative_to(dest.resolve()):raise ValueError('Invalid archive path')
  z.extractall(dest)
 return name+' installed'
with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
 for result in pool.map(fetch,items):print(result,flush=True)
