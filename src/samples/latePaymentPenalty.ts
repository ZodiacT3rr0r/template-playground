const MODEL = `namespace io.clause.latedeliveryandpenalty@0.1.0

import org.accordproject.time@0.3.0.{Duration, TemporalUnit} from https://models.accordproject.org/time@0.3.0.cto

import org.accordproject.contract@0.2.0.Clause from https://models.accordproject.org/accordproject/contract@0.2.0.cto
import org.accordproject.runtime@0.2.0.{Request,Response} from https://models.accordproject.org/accordproject/runtime@0.2.0.cto

/**
 * Defines the data model for the LateDeliveryAndPenalty template.
 * This defines the structure of the abstract syntax tree that the parser for the template
 * must generate from input source text.
 */
@template
asset TemplateModel extends Clause {
  /**
   * Does the clause include a force majeure provision?
   */
  o Boolean forceMajeure

  /**
   * For every penaltyDuration that the goods are late
   */
  o Duration penaltyDuration

  /**
   * Seller pays the buyer penaltyPercentage % of the value of the goods
   */
  o Double penaltyPercentage

  /**
   * Up to capPercentage % of the value of the goods
   */
  o Double capPercentage

  /**
   * If the goods are >= termination late then the buyer may terminate the contract
   */
  o Duration termination

  /**
   * Fractional part of a ... is considered a whole ...
   */
  o TemporalUnit fractionalPart
}

/**
 * Defines the input data required by the template
 */
transaction LateDeliveryAndPenaltyRequest extends Request {

  /**
   * Are we in a force majeure situation?
   */
  o Boolean forceMajeure

  /**
   * What was the agreed delivery date for the goods?
   */
  o DateTime agreedDelivery

  /**
   * If the goods have been delivered, when where they delivered?
   */
  o DateTime deliveredAt optional

  /**
   * What is the value of the goods?
   */
  o Double goodsValue
}

/**
 * Defines the output data for the template
 */
transaction LateDeliveryAndPenaltyResponse extends Response {
  /**
   * The penalty to be paid by the seller
   */
  o Double penalty

  /**
   * Whether the buyer may terminate the contract
   */
  o Boolean buyerMayTerminate
}`;

const TEMPLATE = `Late Delivery and Penalty – {{% return now.toLocaleString() %}}
----

In case of delayed delivery{{#if forceMajeure}}, except for Force Majeure cases,{{/if}} the Seller shall pay to the Buyer for every _{{% return \`\${penaltyDuration.amount} \${penaltyDuration.unit}\` %}} of delay_ ***Penalty*** amounting to {{penaltyPercentage}}% of the total value of the Equipment whose delivery has been delayed.

1. Any fractional part of a {{fractionalPart}} is to be considered a full {{fractionalPart}}.
1. The total amount of penalty shall not however, exceed {{capPercentage}}% of the total value of the Equipment involved in late delivery.
1. If the delay is more than {{% return \`\${termination.amount} \${termination.unit}\` %}}, the Buyer is entitled to terminate this Contract.`;

const LOGIC = `// demo utility function
function calc(input: number) : number {
    const result = input * 2.5;
    return result;
}

type LateDeliveryContractResponse = {
    result: ILateDeliveryAndPenaltyResponse;
}

// sample contract logic that is stateless
// - no init method
// @ts-ignore
class LateDeliveryLogic extends TemplateLogic<ITemplateModel>  {
    async trigger(data: ITemplateModel, request:ILateDeliveryAndPenaltyRequest) : Promise<LateDeliveryContractResponse> {
        return {
            result: {
                penalty: data.penaltyPercentage * calc(request.goodsValue),
                buyerMayTerminate: true,
                $timestamp: new Date(),
                $class: 'io.clause.latedeliveryandpenalty@0.1.0.LateDeliveryAndPenaltyResponse'
            }
        }
    }
}

export default LateDeliveryLogic;`;

const DATA = {
  $class: "io.clause.latedeliveryandpenalty@0.1.0.TemplateModel",
  forceMajeure: true,
  penaltyDuration: {
    $class: "org.accordproject.time@0.3.0.Duration",
    amount: 2,
    unit: "days",
  },
  penaltyPercentage: 10.5,
  capPercentage: 55,
  termination: {
    $class: "org.accordproject.time@0.3.0.Duration",
    amount: 15,
    unit: "days",
  },
  fractionalPart: "days",
  clauseId: "c88e5ed7-c3e0-4249-a99c-ce9278684ac8",
  $identifier: "c88e5ed7-c3e0-4249-a99c-ce9278684ac8",
};

const REQUEST = {
  goodsValue: 100,
};

const NAME = "Late Payment Penalty";

export { NAME, MODEL, TEMPLATE, LOGIC, DATA, REQUEST };

/*
Manual trigger trace with DATA.penaltyPercentage=10.5 and REQUEST.goodsValue=100:
1) calc(100) => 250
2) penalty => 10.5 * 250 = 2625
3) buyerMayTerminate => true
Expected response:
{
  result: {
    penalty: 2625,
    buyerMayTerminate: true,
    $class: "io.clause.latedeliveryandpenalty@0.1.0.LateDeliveryAndPenaltyResponse"
  }
}
This matches demo-template node index.js output for penalty and buyerMayTerminate.
*/
