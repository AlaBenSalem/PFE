const mongoose = require('mongoose');

const kcReferenceSchema = new mongoose.Schema(
  {
    culture: {
      type: String,
      required: true,
      unique: true,
    },
    aliases: {
      type: [String],
      default: [],
    },
    variete: String,
    type: {
      type: String,
      enum: ['agrume', 'cereale', 'legume', 'fruit'],
      required: true,
    },
    stades: [
      {
        nom: String,
        periode: {
          debut: Number, // mois 1-12
          fin: Number,
        },
        kc: Number,
        description: String,
      },
    ],
    kcMoyen: Number,
    references: {
      fao: Boolean,
      source: String,
      notes: String,
    },
  },
  { timestamps: true }
);

kcReferenceSchema.index({ aliases: 1 });

module.exports = mongoose.model('KCReference', kcReferenceSchema);