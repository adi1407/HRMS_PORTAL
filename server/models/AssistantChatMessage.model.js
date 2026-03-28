const mongoose = require('mongoose');

const AssistantChatMessageSchema = new mongoose.Schema(
  {
    thread: { type: mongoose.Schema.Types.ObjectId, ref: 'AssistantChatThread', required: true, index: true },
    role: { type: String, enum: ['user', 'assistant'], required: true },
    content: { type: String, required: true, maxlength: 64000 },
    order: { type: Number, required: true, min: 0 },
  },
  { timestamps: true }
);

AssistantChatMessageSchema.index({ thread: 1, order: 1 });

module.exports = mongoose.model('AssistantChatMessage', AssistantChatMessageSchema);
