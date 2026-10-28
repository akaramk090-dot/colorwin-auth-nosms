from pathlib import Path
import subprocess,os,secrets,shutil,zipfile,xml.etree.ElementTree as ET
root=Path(__file__).resolve().parent.parent;tools=root/'.tools'/'android';work=root/'data'/'colorwin-android-build';work.mkdir(parents=True,exist_ok=True)
javac=next((tools/'jdk').rglob('javac.exe'));java=javac.with_name('java.exe');keytool=javac.with_name('keytool.exe')
aapt=next((tools/'build').rglob('aapt.exe'));zipalign=aapt.with_name('zipalign.exe');d8=next((tools/'build').rglob('d8.jar'));signer=next((tools/'build').rglob('apksigner.jar'));android=next((tools/'platform').rglob('android.jar'))
app=root/'apps'/'android-observer-app'/'app';src=app/'src'/'main';classes=work/'classes';classes.mkdir(exist_ok=True)
(classes/'CreditAmountParserTest.class').unlink(missing_ok=True)
env=dict(os.environ)
def run(args):subprocess.run([str(x) for x in args],check=True,env=env)
# Isolated package avoids overwriting the original app whose upstream signing key was not supplied.
manifest=(src/'AndroidManifest.xml').read_text(encoding='utf-8').replace('package="com.youpi.observer"','package="com.colorwin.observer"').replace('android:versionCode="1"','android:versionCode="2"').replace('android:versionName="1.0.0"','android:versionName="1.1.0"').replace('android:label="YOUPI SMS Gateway"','android:label="Color Win Bank Observer"')
manifestPath=work/'AndroidManifest.xml';manifestPath.write_text(manifest,encoding='utf-8')
libs=list((app/'libs').glob('*.jar'));cp=os.pathsep.join(str(x) for x in [android,*libs]);files=list((src/'java'/'com'/'youpi'/'observer').glob('*.java'))
run([javac,'-encoding','UTF-8','-source','8','-target','8','-cp',cp,'-d',classes,*files])
run([java,'-cp',d8,'com.android.tools.r8.D8','--lib',android,'--min-api','26','--output',work,*classes.rglob('*.class'),*libs])
unsigned=work/'unsigned.apk';aligned=work/'aligned.apk';signed=work/'colorwin-observer.apk'
run([aapt,'package','-f','-M',manifestPath,'-S',src/'res','-I',android,'-F',unsigned])
with zipfile.ZipFile(unsigned,'a',compression=zipfile.ZIP_DEFLATED) as z:z.write(work/'classes.dex','classes.dex')
run([zipalign,'-f','4',unsigned,aligned])
private=root/'data'/'.secrets';private.mkdir(exist_ok=True);key=private/'colorwin-observer.keystore';password=private/'colorwin-observer-keystore-password.txt'
if not key.exists():
 password.write_text(secrets.token_hex(24),encoding='utf-8');env['COLORWIN_APK_KSPASS']=password.read_text(encoding='utf-8')
 run([keytool,'-genkeypair','-keystore',key,'-alias','colorwin-observer','-keyalg','RSA','-keysize','2048','-validity','10000','-storepass:env','COLORWIN_APK_KSPASS','-keypass:env','COLORWIN_APK_KSPASS','-dname','CN=Color Win Bank Observer, O=Color Win, C=IN'])
else:env['COLORWIN_APK_KSPASS']=password.read_text(encoding='utf-8')
run([java,'-jar',signer,'sign','--ks',key,'--ks-pass','env:COLORWIN_APK_KSPASS','--key-pass','env:COLORWIN_APK_KSPASS','--ks-key-alias','colorwin-observer','--out',signed,aligned])
run([java,'-jar',signer,'verify','--verbose',signed])
for target in [root/'apps'/'payment-api'/'public'/'youpi-sms-gateway.apk',root/'apps'/'merchant-admin'/'public'/'youpi-sms-gateway.apk',root/'apps'/'android-observer-app'/'youpi-sms-gateway.apk']:
 backup=work/('original-'+target.parent.name+'.apk')
 if target.exists() and not backup.exists():shutil.copy2(target,backup)
 target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(signed,target)
print('Signed Color Win Bank Observer 1.1.0 ready. Existing upstream APK backups preserved.',flush=True)
