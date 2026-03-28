const mongoose = require('mongoose');

const AssistantChatThreadSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    title: { type: String, trim: true, maxlength: 120, default: 'Conversation' },
  },
  { timestamps: true }
);

AssistantChatThreadSchema.index({ user: 1, updatedAt: -1 });

module.exports = mongoose.model('AssistantChatThread', AssistantChatThreadSchema);
