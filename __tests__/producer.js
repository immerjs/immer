"use strict"
import produce, {setUseProxies, producer} from "../src/index"

runTests("proxy", true)
runTests("es5", false)

function runTests(name, useProxies) {
    describe("producer - " + name, () => {
        setUseProxies(useProxies)

        it("supports producer decorator", () => {
            class Clock {
                constructor(hours = 0, minutes = 0) {
                    this.hours = hours
                    this.minutes = minutes
                }

                increment(hours, minutes = 0) {
                    this.hours += hours
                    this.minutes += minutes
                }

                toString() {
                    return `${("" + this.hours).padStart(2, 0)}:${(
                        "" + this.minutes
                    ).padStart(2, 0)}`
                }
            }
            producer(Clock.prototype, "increment")

            expect(() =>
                producer(Clock, "increment")
            ).toThrowErrorMatchingSnapshot()
            expect(() =>
                producer(Clock.prototype, "notExisting")
            ).toThrowErrorMatchingSnapshot()

            const midnight = new Clock()
            const lunch = midnight.increment(12, 30)

            expect(midnight).not.toBe(lunch)
            expect(lunch).toBeInstanceOf(Clock)
            expect(midnight.toString()).toBe("00:00")
            expect(lunch.toString()).toBe("12:30")

            const diner = lunch.increment(6)

            expect(diner).not.toBe(lunch)
            expect(lunch).toBeInstanceOf(Clock)
            expect(diner.toString()).toBe("18:30")
        })
    })
}
