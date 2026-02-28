/**
 * Pre-loaded PDF content - simulates parsed PDF textbooks/slides
 * Per user request: PDF to lectures feature
 */

export interface PDFLecture {
  id: string;
  title: string;
  source: string; // e.g., "Textbook Chapter 3", "Lecture Slides Week 2"
  pdfUrl?: string; // Optional: link to actual PDF
  sections: {
    id: string;
    title: string;
    content: string;
    pageNumbers?: string; // e.g., "pp. 45-52"
  }[];
}

/**
 * Example 1: Machine Learning Textbook Chapter
 */
export const ML_TEXTBOOK_CHAPTER: PDFLecture = {
  id: "ml_textbook_ch3",
  title: "Introduction to Machine Learning",
  source: "Machine Learning Fundamentals - Chapter 3",
  sections: [
    {
      id: "ml_overview",
      title: "What is Machine Learning?",
      pageNumbers: "pp. 45-48",
      content: `
Machine learning is a subset of artificial intelligence that enables computers to learn from data without being explicitly programmed.

Three Main Types of Machine Learning:

1. Supervised Learning
   - The algorithm learns from labeled training data
   - Examples: Classification (spam detection), Regression (price prediction)
   - Goal: Learn a mapping from inputs to outputs

2. Unsupervised Learning
   - The algorithm finds patterns in unlabeled data
   - Examples: Clustering (customer segmentation), Dimensionality reduction
   - Goal: Discover hidden structure in data

3. Reinforcement Learning
   - The algorithm learns through trial and error
   - Agent interacts with environment to maximize rewards
   - Examples: Game playing, robotics, recommendation systems

Key Concepts:
- Training Data: Historical examples used to train the model
- Features: Input variables that describe the data
- Labels: Output variables we want to predict
- Model: Mathematical representation learned from data
- Generalization: Ability to perform well on new, unseen data

The fundamental goal of machine learning is to build models that generalize well beyond the training data, enabling accurate predictions on new examples.
      `.trim(),
    },
    {
      id: "ml_algorithms",
      title: "Common ML Algorithms",
      pageNumbers: "pp. 49-55",
      content: `
Popular Machine Learning Algorithms:

Linear Regression:
- Predicts continuous values
- Fits a line to minimize squared errors
- Example: Predicting house prices based on size

Logistic Regression:
- Classification algorithm for binary outcomes
- Uses sigmoid function to output probabilities
- Example: Email spam detection (spam vs. not spam)

Decision Trees:
- Tree-like model of decisions
- Easy to interpret and visualize
- Can handle both classification and regression
- Example: Medical diagnosis based on symptoms

Random Forests:
- Ensemble of decision trees
- Reduces overfitting through averaging
- More robust than single decision trees
- Example: Credit risk assessment

Support Vector Machines (SVM):
- Finds optimal decision boundary between classes
- Works well in high-dimensional spaces
- Example: Image classification

K-Nearest Neighbors (KNN):
- Classifies based on proximity to training examples
- Simple but can be computationally expensive
- Example: Recommendation systems

Neural Networks:
- Inspired by biological neurons
- Can learn complex non-linear patterns
- Foundation for deep learning
- Example: Image recognition, natural language processing

Choosing the Right Algorithm:
- Consider the type of problem (classification vs. regression)
- Size and quality of available data
- Interpretability requirements
- Computational resources and time constraints
      `.trim(),
    },
    {
      id: "ml_evaluation",
      title: "Model Evaluation and Metrics",
      pageNumbers: "pp. 56-62",
      content: `
How to Evaluate Machine Learning Models:

Training vs. Test Data:
- Split data into training set (70-80%) and test set (20-30%)
- Train on training set, evaluate on test set
- Ensures model generalizes to unseen data

Classification Metrics:

Accuracy:
- Percentage of correct predictions
- Limitation: Can be misleading with imbalanced classes

Precision:
- Of all positive predictions, how many were correct?
- Precision = True Positives / (True Positives + False Positives)
- Important when false positives are costly

Recall (Sensitivity):
- Of all actual positives, how many did we catch?
- Recall = True Positives / (True Positives + False Negatives)
- Important when false negatives are costly

F1-Score:
- Harmonic mean of precision and recall
- Balances precision and recall
- F1 = 2 * (Precision * Recall) / (Precision + Recall)

Confusion Matrix:
- Shows true positives, false positives, true negatives, false negatives
- Provides complete picture of model performance

Regression Metrics:

Mean Absolute Error (MAE):
- Average absolute difference between predictions and actual values
- Easy to interpret, in same units as target variable

Mean Squared Error (MSE):
- Average squared difference
- Penalizes large errors more heavily

R-squared (R²):
- Proportion of variance explained by the model
- Ranges from 0 to 1 (higher is better)

Cross-Validation:
- Split data into k folds
- Train on k-1 folds, test on remaining fold
- Repeat k times and average results
- Provides more robust estimate of model performance
      `.trim(),
    },
  ],
};

/**
 * Example 2: Lecture Slides on Deep Learning
 */
export const DEEP_LEARNING_SLIDES: PDFLecture = {
  id: "dl_slides_week4",
  title: "Deep Learning Fundamentals",
  source: "CS229 Lecture Slides - Week 4",
  sections: [
    {
      id: "dl_intro",
      title: "Introduction to Deep Learning",
      pageNumbers: "Slides 1-8",
      content: `
Deep Learning: Neural networks with multiple hidden layers

Why Deep Learning?
- Automatically learns features from raw data
- Excels at complex pattern recognition
- State-of-the-art results in computer vision, NLP, speech recognition

Deep vs. Shallow Networks:
- Shallow: 1-2 hidden layers
- Deep: 3+ hidden layers
- Deeper networks can learn hierarchical representations

Example: Image Recognition
- Layer 1: Detects edges
- Layer 2: Detects shapes
- Layer 3: Detects object parts
- Layer 4: Recognizes complete objects

Key Innovations:
1. Big Data: Massive datasets (ImageNet, Common Crawl)
2. GPU Computing: Parallel processing for faster training
3. Better Activation Functions: ReLU instead of sigmoid
4. Regularization: Dropout, batch normalization
5. Transfer Learning: Pre-trained models fine-tuned for specific tasks

Applications:
- Computer Vision: Image classification, object detection, facial recognition
- Natural Language Processing: Translation, sentiment analysis, chatbots
- Speech Recognition: Voice assistants, transcription
- Generative Models: Image generation, text generation, music composition
      `.trim(),
    },
    {
      id: "dl_architectures",
      title: "Deep Learning Architectures",
      pageNumbers: "Slides 9-15",
      content: `
Common Deep Learning Architectures:

Convolutional Neural Networks (CNNs):
- Specialized for image data
- Uses convolutional layers to detect local patterns
- Pooling layers reduce spatial dimensions
- Architecture: Conv → ReLU → Pool → Conv → ReLU → Pool → Dense
- Applications: Image classification, object detection, medical imaging

Recurrent Neural Networks (RNNs):
- Designed for sequential data
- Maintains hidden state across time steps
- Can process variable-length inputs
- Challenge: Vanishing gradient problem
- Applications: Time series prediction, text generation

Long Short-Term Memory (LSTM):
- Variant of RNN that addresses vanishing gradients
- Uses gates to control information flow
- Can learn long-term dependencies
- Applications: Language modeling, machine translation

Transformers:
- Attention-based architecture
- Processes entire sequence in parallel
- State-of-the-art for NLP tasks
- Examples: GPT, BERT, T5
- Applications: Translation, question answering, text generation

Generative Adversarial Networks (GANs):
- Two networks compete: Generator and Discriminator
- Generator creates fake data, Discriminator tries to detect fakes
- Through competition, Generator learns to create realistic data
- Applications: Image generation, style transfer, data augmentation

Autoencoders:
- Learn compressed representation of data
- Encoder: Compresses input to latent space
- Decoder: Reconstructs input from latent representation
- Applications: Dimensionality reduction, denoising, anomaly detection
      `.trim(),
    },
  ],
};

/**
 * Get all PDF lectures
 */
export function getAllPDFLectures(): PDFLecture[] {
  return [ML_TEXTBOOK_CHAPTER, DEEP_LEARNING_SLIDES];
}

/**
 * Get a specific PDF lecture by ID
 */
export function getPDFLectureById(id: string): PDFLecture | undefined {
  return getAllPDFLectures().find((lecture) => lecture.id === id);
}
