const mongoose = require('mongoose');

const FeedbackRatingSchema = new mongoose.Schema(
  {
    rater: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    ratee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    direction: {
      type: String,
      enum: ['LEADERSHIP_TO_EMPLOYEE', 'EMPLOYEE_TO_LEADERSHIP'],
      required: true,
    },
    /** Monday 00:00:00 IST for the rating week (stored as Date) */
    weekStart: {
      type: Date,
      required: true,
      index: true,
    },
    score: { type: Number, required: true, min: 1, max: 5 },
    review: { type: String, required: true, trim: true, minlength: 20, maxlength: 500 },
  },
  { timestamps: true }
);

FeedbackRatingSchema.index({ rater: 1, ratee: 1, weekStart: 1, direction: 1 }, { unique: true });

module.exports = mongoose.model('FeedbackRating', FeedbackRatingSchema);
