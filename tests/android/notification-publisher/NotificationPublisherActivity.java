package qa;
import android.app.Activity;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.os.Bundle;
public final class NotificationPublisherActivity extends Activity {
  @Override public void onCreate(Bundle state) {
    super.onCreate(state);
    NotificationManager manager=getSystemService(NotificationManager.class);
    String channel="hamster-synthetic-payment";
    NotificationChannel definition=new NotificationChannel(channel,"Synthetic payment QA",NotificationManager.IMPORTANCE_DEFAULT);
    definition.setSound(null,null);
    manager.createNotificationChannel(definition);
    int id=getIntent().getIntExtra("id",1);
    if(getIntent().getBooleanExtra("cancel",false)) { manager.cancel("hamster-qa",id); finish();return; }
    String title=getIntent().getStringExtra("title");
    String text=getIntent().getStringExtra("text");
    Notification.Builder builder=new Notification.Builder(this,channel)
      .setSmallIcon(android.R.drawable.ic_dialog_info).setContentTitle(title).setContentText(text)
      .setStyle(new Notification.BigTextStyle().bigText(text)).setWhen(System.currentTimeMillis()).setAutoCancel(false);
    if(getIntent().getBooleanExtra("summary",false)) builder.setGroup("hamster-qa").setGroupSummary(true);
    manager.notify("hamster-qa",id,builder.build());
    finish();
  }
}
