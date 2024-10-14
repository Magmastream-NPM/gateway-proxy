class GatewayEvent {
  constructor(eventType = null, op, sequence = null) {
    this.eventType = eventType; // EventTypeInfo instance
    this.op = op; // OpInfo instance
    this.sequence = sequence; // SequenceInfo instance
  }

  static fromJson(input) {
    const op = this.findOpcode(input);
    if (!op) return null;

    const eventType = this.findEventType(input);
    const sequence = this.findSequence(input);

    return new GatewayEvent(eventType, op, sequence);
  }

  // Get the opcode of the payload
  getOp() {
    return this.op.value;
  }

  // Return the opcode, event type, and sequence
  intoParts() {
    return [this.op, this.sequence, this.eventType];
  }

  static findEventType(input) {
    const eventTypeMatch = input.match(/"t":"(.*?)"/);
    if (!eventTypeMatch) return null;

    const eventType = eventTypeMatch[1];
    const start = eventTypeMatch.index + 4; // 4 for '"t":'
    const end = start + eventType.length;
    const range = [start, end];

    return new EventTypeInfo(eventType, range);
  }

  static findOpcode(input) {
    const opInfo = this.findInteger(input, '"op":');
    if (!opInfo) return null;

    const [op, range] = opInfo;
    return new OpInfo(op, range);
  }

  static findSequence(input) {
    const seqInfo = this.findInteger(input, '"s":');
    if (!seqInfo) return null;

    const [seq, range] = seqInfo;
    return new SequenceInfo(seq, range);
  }

  static findInteger(input, key) {
    const keyMatch = input.match(new RegExp(`${key}\\s*(\\d+)`));
    if (!keyMatch) return null;

    const value = parseInt(keyMatch[1], 10);
    const start = keyMatch.index + key.length;
    const end = start + keyMatch[1].length;
    const range = [start, end];

    return [value, range];
  }
}

class OpInfo {
  constructor(value, range) {
    this.value = value; // Integer value
    this.range = range; // Range of the opcode in the string
  }
}

class EventTypeInfo {
  constructor(value, range) {
    this.value = value; // Event type string
    this.range = range; // Range of the event type in the string
  }
}

class SequenceInfo {
  constructor(value, range) {
    this.value = value; // Sequence number
    this.range = range; // Range of the sequence number in the string
  }
}

// Example usage
const jsonPayload = '{"op":2,"t":"MESSAGE_CREATE","s":42}';
const event = GatewayEvent.fromJson(jsonPayload);

if (event) {
  console.log("Opcode:", event.getOp());
  console.log("Event Type:", event.eventType.value);
  console.log("Sequence:", event.sequence.value);
}
