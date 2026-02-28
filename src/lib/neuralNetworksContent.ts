/**
 * Pre-loaded lecture content for "Neural Networks Basics"
 * Per PRD Section 2: Pre-loaded Lecture Content
 * One topic with 3-4 sections, no live PDF parsing
 */

export interface LectureSection {
  id: string;
  title: string;
  content: string;
  order: number;
}

export interface LectureTopic {
  id: string;
  title: string;
  description: string;
  sections: LectureSection[];
}

/**
 * Neural Networks Basics - Main topic with 4 sections
 */
export const NEURAL_NETWORKS_TOPIC: LectureTopic = {
  id: "neural_networks",
  title: "Neural Networks Basics",
  description: "Introduction to neural networks, from neurons to backpropagation",
  sections: [
    {
      id: "intro",
      title: "Introduction to Artificial Neurons",
      order: 1,
      content: `
An artificial neuron is the fundamental building block of neural networks, inspired by biological neurons in the brain.

Key Concepts:
- A neuron receives multiple inputs, each with an associated weight
- The inputs are multiplied by their weights and summed together
- A bias term is added to this sum
- The result is passed through an activation function to produce the output

The Mathematical Model:
output = activation(w1*x1 + w2*x2 + ... + wn*xn + bias)

Where:
- x1, x2, ..., xn are the input values
- w1, w2, ..., wn are the weights
- bias is an additional parameter that allows the neuron to shift its decision boundary
- activation is a non-linear function (like ReLU, sigmoid, or tanh)

Why Non-Linear Activation?
Without activation functions, neural networks would just be linear transformations, unable to learn complex patterns. Non-linear activations enable networks to model sophisticated relationships in data.
      `.trim(),
    },
    {
      id: "network_architecture",
      title: "Network Architecture and Layers",
      order: 2,
      content: `
A neural network is composed of layers of interconnected neurons, organized hierarchically.

Types of Layers:
1. Input Layer: Receives raw data, number of neurons equals number of features
2. Hidden Layers: Intermediate layers that process information, can have any number of neurons
3. Output Layer: Produces final predictions, number of neurons depends on the task

Forward Propagation:
Data flows from the input layer through hidden layers to the output layer.
- Each neuron in layer L receives outputs from all neurons in layer L-1
- Neurons compute their outputs and pass them to layer L+1
- This continues until reaching the output layer

Universal Approximation Theorem:
A neural network with a single hidden layer containing enough neurons can approximate any continuous function. However, deeper networks (with multiple hidden layers) are often more efficient and practical.

Architecture Examples:
- Shallow Network: Input → Hidden (1 layer) → Output
- Deep Network: Input → Hidden (many layers) → Output
- Convolutional: Uses shared weights for image processing
- Recurrent: Maintains memory for sequence processing
      `.trim(),
    },
    {
      id: "training",
      title: "Training and Backpropagation",
      order: 3,
      content: `
Training a neural network involves adjusting its weights and biases to minimize prediction errors.

The Training Process:
1. Initialize weights randomly or with smart initialization schemes
2. Forward pass: Compute predictions for training examples
3. Calculate loss: Measure how wrong the predictions are
4. Backward pass (Backpropagation): Compute gradients of the loss with respect to each weight
5. Update weights: Adjust weights to reduce the loss (using an optimizer like SGD or Adam)
6. Repeat until convergence

Loss Functions:
- Mean Squared Error (MSE): For regression tasks, measures average squared difference
- Cross-Entropy: For classification tasks, measures probability distribution difference
- Loss = (1/n) * sum of individual errors

The Chain Rule (Core of Backpropagation):
∂L/∂w = ∂L/∂output * ∂output/∂hidden * ∂hidden/∂w

This allows us to efficiently compute gradients for every weight in the network, working backwards from the output.

Optimization:
- Learning Rate: Controls how big each weight update step is
- Batch Size: Number of examples processed before updating weights
- Epochs: Number of times we iterate through the entire training dataset
- Momentum: Helps accelerate learning and escape local minima
      `.trim(),
    },
    {
      id: "activation_functions",
      title: "Activation Functions and Non-Linearity",
      order: 4,
      content: `
Activation functions introduce non-linearity into neural networks, enabling them to learn complex relationships.

Common Activation Functions:

ReLU (Rectified Linear Unit):
- Formula: ReLU(x) = max(0, x)
- Advantages: Simple, fast, works well in practice
- Disadvantages: Can suffer from "dying ReLU" problem

Sigmoid:
- Formula: sigmoid(x) = 1 / (1 + e^-x)
- Range: [0, 1], useful for probability outputs
- Disadvantages: Vanishing gradient problem in deep networks

Tanh (Hyperbolic Tangent):
- Formula: tanh(x) = (e^x - e^-x) / (e^x + e^-x)
- Range: [-1, 1], zero-centered output
- Better than sigmoid but still suffers from vanishing gradients

Softmax:
- Used in output layer for multi-class classification
- Converts raw scores into probability distribution
- Formula: softmax(xi) = e^xi / sum(e^xj)

Choosing Activation Functions:
- Hidden layers: ReLU is standard choice (fast and effective)
- Output layer (regression): Linear (no activation) or ReLU
- Output layer (binary classification): Sigmoid
- Output layer (multi-class): Softmax
- Output layer (regression, bounded): Tanh or Sigmoid

Why They Matter:
Without activations, stacking layers just creates one big linear transformation. Activations allow networks to create non-linear decision boundaries and approximate any function.
      `.trim(),
    },
  ],
};

/**
 * Utility function to get a specific section
 */
export function getSectionById(sectionId: string): LectureSection | undefined {
  return NEURAL_NETWORKS_TOPIC.sections.find((s) => s.id === sectionId);
}

/**
 * Utility function to get all sections sorted by order
 */
export function getAllSections(): LectureSection[] {
  return NEURAL_NETWORKS_TOPIC.sections.sort((a, b) => a.order - b.order);
}
