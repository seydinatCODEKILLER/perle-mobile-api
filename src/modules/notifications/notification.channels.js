class BaseChannel {
  get name() { throw new Error("name doit être implémenté"); }
  async send(notification, member) { throw new Error("send() doit être implémenté"); }
}

class InAppChannel extends BaseChannel {
  get name() { return "IN_APP"; }
  async send(notification, member) { return true; }
}

class EmailChannel extends BaseChannel {
  get name() { return "EMAIL"; }
  async send(notification, member) {
    // TODO: Brancher SendGrid / Nodemailer
    console.log(`[EMAIL] → ${member.email} : ${notification.title}`);
    return true;
  }
}

class SmsChannel extends BaseChannel {
  get name() { return "SMS"; }
  async send(notification, member) {
    // TODO: Brancher Africa's Talking / Twilio
    console.log(`[SMS] → ${member.phone} : ${notification.message}`);
    return true;
  }
}

class WhatsAppChannel extends BaseChannel {
  get name() { return "WHATSAPP"; }
  async send(notification, member) {
    // TODO: Brancher Twilio WhatsApp / 360Dialog
    console.log(`[WHATSAPP] → ${member.phone} : ${notification.message}`);
    return true;
  }
}

export const ChannelRegistry = {
  IN_APP: new InAppChannel(),
  EMAIL: new EmailChannel(),
  SMS: new SmsChannel(),
  WHATSAPP: new WhatsAppChannel(),
};