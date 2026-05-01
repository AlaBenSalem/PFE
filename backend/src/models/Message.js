const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    senderName: { type: String, required: true, trim: true, maxlength: 120 },
    senderEmail: { type: String, required: true, trim: true, lowercase: true, maxlength: 180 },
    subject: { type: String, default: "", trim: true, maxlength: 140 },
    body: { type: String, required: true, trim: true, maxlength: 5000 },
    readAt:     { type: Date, default: null },
    repliedAt:  { type: Date, default: null },
    replyBody:  { type: String, default: null, maxlength: 5000 },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Message", messageSchema);

