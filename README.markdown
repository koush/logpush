logpush is a service that will let you curl a URL that identifies a specific device, and it will return that device log in real time.
It works by sending a Android Cloud to Device Message that requests the device log. The device log is sent back over
and then printed back to the original requestor.


The Android side of things needs to support push notifications.

Server Usage:
GET request on /<registration_id>?username=....&password=....

registration_id: the Android C2DM registration for the device.
username: google account associated with this push registration
password: password for above google account

Ie,
curl -v 'https://logpush.deployfu.com/K77JZE72_Fxqnwzz3H50SID0qMw8OfjlfwztCV00AhtWuyTbwSVMZxZBm.....?username=me@example.com&password=swordfish'

This will get you a log of the given Android device.
It's also possible to get a streaming log, but that doesn't play well behind nginx, EC2 Load balancer, and other reverse proxies.
Need to look into that more later.


How to hook things up on the Android side:

Set up push (RTFM on how to do that).
Add this permission:
<uses-permission android:name="android.permission.READ_LOGS" />

On your C2DM intent:

String type = intent.getStringExtra("type");
if ("log".equals(type)) {
  sendLog(intent);
}
  

Code for sendLog:



```

public final static String LINE_SEPARATOR = System.getProperty("line.separator");
static void sendLog(Intent intent) {
    final String registrationId = intent.getStringExtra("registration_id");
    if (registrationId == null)
        return;
    new Thread() {
        public void run() {
            AndroidHttpClient client = AndroidHttpClient.newInstance("LogPush");
            try{
                ArrayList<String> commandLine = new ArrayList<String>();
                commandLine.add("logcat");
                commandLine.add("-d");

                Process process = Runtime.getRuntime().exec(commandLine.toArray(new String[0]));
                byte[] data = StreamUtility.readToEndAsArray(process.getInputStream());
                HttpPost post = new HttpPost("https://logpush.deployfu.com/" + registrationId);
                post.setEntity(new ByteArrayEntity(data));
                post.setHeader("Content-Type", "application/binary");
                HttpResponse resp = client.execute(post);
                String contents = StreamUtility.readToEnd(resp.getEntity().getContent());
                Log.i("LogPush", contents);
            } 
            catch (IOException e){
                client.close();
                e.printStackTrace();
            } 
        }
    }.start();
}
```


